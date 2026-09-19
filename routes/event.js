const express = require('express');
const app  = express.Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const db = require('../config/db.js');
const jwthelper = require('../utils/jwt_helper.js');

// Ensure uploads directory exists
const BANNER_DIR = path.join(__dirname, '../public/uploads/banners');
fs.mkdirSync(BANNER_DIR, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, BANNER_DIR),
        filename:    (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
            cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    },
});

// POST /upload-banner — authenticated, saves image to local disk and returns a public URL
app.post('/upload-banner', jwthelper.verifyAccessToken, upload.single('banner'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }

        // Derive origin from the incoming request rather than a hardcoded LAN IP,
        // which drifts every time this machine gets a new DHCP lease.
        const origin = process.env.SERVER_ORIGIN || `${req.protocol}://${req.get('host')}`;
        const url = `${origin}/uploads/banners/${req.file.filename}`;
        return res.status(200).json({ success: true, url });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message || 'Upload failed' });
    }
});

// POST /create-event — authenticated
app.post('/create-event', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const { title, date, venue, type, banner_url, category, description, time, max_capacity } = req.body;

        if (!title || !date || !venue) {
            return res.status(400).json({
                success: false,
                message: 'title, date, and venue are required'
            });
        }

        const id_user = req.payload.aud;

        const [result] = await db.query(
            `INSERT INTO events
                (id_user, title, date, venue, type, banner_url, category, description, time, max_capacity, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [id_user, title, date, venue,
             type || 'physical', banner_url || null, category || null,
             description || null, time || null, max_capacity ? parseInt(max_capacity) : null]
        );

        const [rows] = await db.query('SELECT * FROM events WHERE id_event = ?', [result.insertId]);

        return res.status(200).json({
            success: true,
            message: 'Event created successfully',
            data: formatEvent(rows[0]),
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// PUT /events/:id — authenticated, owner only
app.put('/events/:id', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const id_user = req.payload.aud;
        const [rows] = await db.query('SELECT * FROM events WHERE id_event = ?', [req.params.id]);
        const event = rows[0];

        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (String(event.id_user) !== String(id_user)) {
            return res.status(403).json({ success: false, message: 'Not authorised to edit this event' });
        }

        const { title, date, venue, type, banner_url, category, description, time, max_capacity, status } = req.body;

        const updates = [];
        const params  = [];

        if (title        !== undefined) { updates.push('title = ?');        params.push(title); }
        if (date         !== undefined) { updates.push('date = ?');         params.push(date); }
        if (venue        !== undefined) { updates.push('venue = ?');        params.push(venue); }
        if (type         !== undefined) { updates.push('type = ?');         params.push(type); }
        if (banner_url   !== undefined) { updates.push('banner_url = ?');   params.push(banner_url); }
        if (category     !== undefined) { updates.push('category = ?');     params.push(category || null); }
        if (description  !== undefined) { updates.push('description = ?');  params.push(description || null); }
        if (time         !== undefined) { updates.push('time = ?');         params.push(time || null); }
        if (max_capacity !== undefined) { updates.push('max_capacity = ?'); params.push(max_capacity ? parseInt(max_capacity) : null); }
        if (status       !== undefined) { updates.push('status = ?');       params.push(status); }

        if (!updates.length) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        params.push(req.params.id);
        await db.query(`UPDATE events SET ${updates.join(', ')} WHERE id_event = ?`, params);

        const [updated] = await db.query('SELECT * FROM events WHERE id_event = ?', [req.params.id]);
        return res.status(200).json({ success: true, data: formatEvent(updated[0]) });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// PATCH /events/:id/cancel — authenticated, owner only
app.patch('/events/:id/cancel', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const id_user = req.payload.aud;
        const [rows] = await db.query('SELECT * FROM events WHERE id_event = ?', [req.params.id]);
        const event = rows[0];

        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (String(event.id_user) !== String(id_user)) {
            return res.status(403).json({ success: false, message: 'Not authorised to cancel this event' });
        }
        if (event.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Event is already cancelled' });
        }

        await db.query("UPDATE events SET status = 'cancelled' WHERE id_event = ?", [req.params.id]);

        const [updated] = await db.query('SELECT * FROM events WHERE id_event = ?', [req.params.id]);
        return res.status(200).json({ success: true, message: 'Event cancelled', data: formatEvent(updated[0]) });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// GET /events — public
// ?section=just_added   → 10 most recently created active events
// ?section=upcoming     → next active events ordered by date
// ?section=parties      → active events where category = 'party'
// ?category=<value>     → filter by any category
// no params             → events list + category pill-bar data for the Discover page
app.get('/events', async (req, res) => {
    try {
        const { section, category } = req.query;
        const cap = Math.min(Number(req.query.limit) || 10, 50);

        if (section === 'just_added') {
            const [rows] = await db.query(
                `SELECT * FROM events
                 WHERE status = 'active'
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [cap]
            );
            return res.status(200).json({ success: true, data: rows.map(formatEvent) });

        } else if (section === 'upcoming') {
            const [rows] = await db.query(
                `SELECT * FROM events
                 WHERE status = 'active' AND date >= CURDATE()
                 ORDER BY date ASC
                 LIMIT ?`,
                [cap]
            );
            return res.status(200).json({ success: true, data: rows.map(formatEvent) });

        } else if (section === 'parties') {
            const [rows] = await db.query(
                `SELECT * FROM events
                 WHERE status = 'active' AND category = 'party'
                 ORDER BY date ASC
                 LIMIT ?`,
                [cap]
            );
            return res.status(200).json({ success: true, data: rows.map(formatEvent) });

        } else if (category) {
            const rawOffset = Math.max(Number(req.query.offset) || 0, 0);
            const sortMap   = { date_asc: 'date ASC', date_desc: 'date DESC' };
            const orderBy   = sortMap[req.query.sort] || 'created_at DESC';

            const [rows] = await db.query(
                `SELECT * FROM events
                 WHERE status = 'active' AND category = ?
                 ORDER BY ${orderBy}
                 LIMIT ? OFFSET ?`,
                [category, cap, rawOffset]
            );
            return res.status(200).json({ success: true, data: rows.map(formatEvent) });

        } else {
            // Discover page: event list (each tagged with its lowest ticket price)
            // plus category counts to drive the category pill bar.
            const [[rows], [categoryRows], [[{ total }]], [[{ free_count }]]] = await Promise.all([
                db.query(
                    `SELECT e.*,
                            (SELECT MIN(tt.price) FROM ticket_tiers tt WHERE tt.event_id = e.id_event) AS min_price
                     FROM events e
                     WHERE e.status = 'active'
                     ORDER BY e.date ASC
                     LIMIT ?`,
                    [cap]
                ),
                db.query(
                    `SELECT category, COUNT(*) AS count
                     FROM events
                     WHERE status = 'active' AND category IS NOT NULL
                     GROUP BY category`
                ),
                db.query(`SELECT COUNT(*) AS total FROM events WHERE status = 'active'`),
                db.query(
                    `SELECT COUNT(DISTINCT e.id_event) AS free_count
                     FROM events e
                     JOIN ticket_tiers tt ON tt.event_id = e.id_event
                     WHERE e.status = 'active' AND tt.price = 0`
                ),
            ]);

            const events = rows.map(r => ({
                ...formatEvent(r),
                price: r.min_price !== null ? Number(r.min_price) : null,
            }));

            return res.status(200).json({
                success: true,
                data: {
                    events,
                    categories: [
                        { name: 'All', count: Number(total) },
                        ...categoryRows.map(r => ({ name: r.category, count: Number(r.count) })),
                        { name: 'Free', count: Number(free_count) },
                    ],
                },
            });
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// GET /events/search — public (must be before /events/:id so Express doesn't treat "search" as an id)
// ?q=<text>        → searches title and venue (required, min 1 char)
// ?category=<val>  → optional category filter
// ?type=<val>      → optional type filter (physical | virtual)
// ?date=<YYYY-MM-DD> → optional exact date filter
// ?limit=<n>       → max 50, default 20
// ?offset=<n>      → for pagination
app.get('/events/search', async (req, res) => {
    try {
        const q        = (req.query.q || '').trim();
        const category = req.query.category || null;
        const type     = req.query.type     || null;
        const date     = req.query.date     || null;
        const limit    = Math.min(Number(req.query.limit)  || 20, 50);
        const offset   = Math.max(Number(req.query.offset) || 0,  0);

        if (!q) {
            return res.status(400).json({ success: false, message: 'q is required' });
        }

        const like   = `%${q}%`;
        const where  = ['e.status = ?', '(e.title LIKE ? OR e.venue LIKE ?)'];
        const params = ['active', like, like];

        if (category) { where.push('e.category = ?'); params.push(category); }
        if (type)     { where.push('e.type = ?');     params.push(type); }
        if (date)     { where.push('DATE(e.date) = ?'); params.push(date); }

        const baseWhere = where.join(' AND ');

        const [[{ total }], [rows]] = await Promise.all([
            db.query(
                `SELECT COUNT(*) AS total FROM events e WHERE ${baseWhere}`,
                params
            ),
            db.query(
                `SELECT e.*, u.full_name AS organizer_name
                 FROM events e
                 LEFT JOIN users u ON u.id_user = e.id_user
                 WHERE ${baseWhere}
                 ORDER BY e.date ASC
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            ),
        ]);

        return res.status(200).json({
            success: true,
            data:     rows.map(formatEvent),
            total,
            has_more: offset + rows.length < total,
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// GET /events/:id — public, returns one event with organizer info
app.get('/events/:id', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.*, u.full_name AS organizer_name, u.email AS organizer_email
             FROM events e
             LEFT JOIN users u ON u.id_user = e.id_user
             WHERE e.id_event = ? AND e.status = 'active'`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const row = rows[0];
        return res.status(200).json({
            success: true,
            data: {
                ...formatEvent(row),
                organizer: {
                    name: row.organizer_name,
                    email: row.organizer_email,
                },
            },
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// GET /admin/events — authenticated, returns all events created by the logged-in user
app.get('/admin/events', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const id_user = req.payload.aud;

        const [rows] = await db.query(
            `SELECT e.*,
                COALESCE((
                    SELECT SUM(tt.sold)
                    FROM ticket_tiers tt
                    WHERE tt.event_id = e.id_event
                ), 0) AS tickets_sold,
                COALESCE((
                    SELECT SUM(ts.total_price)
                    FROM ticket_sales ts
                    WHERE ts.event_id = e.id_event
                ), 0) AS revenue
             FROM events e
             WHERE e.id_user = ?
             ORDER BY e.created_at DESC`,
            [id_user]
        );

        return res.status(200).json({ success: true, data: rows.map(formatEvent) });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// GET /admin/stats — global daily stats across all organizer's events
// ?days=N  → rolling window (default 30, max 365)
app.get('/admin/stats', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const id_user = req.payload.aud;
        const days    = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);

        const [[daily], [topEvents]] = await Promise.all([
            db.query(
                `SELECT
                    DATE(ts.purchased_at)   AS date,
                    COUNT(ts.id)            AS tickets,
                    SUM(ts.total_price)     AS revenue
                 FROM ticket_sales ts
                 JOIN events e ON ts.event_id = e.id_event
                 WHERE e.id_user = ?
                   AND ts.purchased_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                 GROUP BY DATE(ts.purchased_at)
                 ORDER BY date ASC`,
                [id_user, days]
            ),
            db.query(
                `SELECT
                    e.id_event              AS id,
                    e.title,
                    e.date                  AS event_date,
                    e.banner_url,
                    COUNT(ts.id)            AS tickets_sold,
                    COALESCE(SUM(ts.total_price), 0) AS revenue
                 FROM events e
                 LEFT JOIN ticket_sales ts ON ts.event_id = e.id_event
                 WHERE e.id_user = ?
                 GROUP BY e.id_event, e.title, e.date, e.banner_url
                 ORDER BY tickets_sold DESC
                 LIMIT 5`,
                [id_user]
            ),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                daily:      daily.map(r => ({ date: r.date, tickets: Number(r.tickets), revenue: Number(r.revenue) })),
                top_events: topEvents.map(r => ({
                    id:           r.id,
                    title:        r.title,
                    event_date:   r.event_date,
                    banner_url:   r.banner_url,
                    tickets_sold: Number(r.tickets_sold),
                    revenue:      Number(r.revenue),
                })),
            },
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// GET /admin/events/:id/stats — per-event stats with daily breakdown and tier distribution
// ?days=N  → rolling window for daily chart (default 30, max 365)
app.get('/admin/events/:id/stats', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const id_user  = req.payload.aud;
        const event_id = req.params.id;
        const days     = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);

        // Verify ownership
        const [evRows] = await db.query(
            'SELECT id_event, title, max_capacity FROM events WHERE id_event = ? AND id_user = ?',
            [event_id, id_user]
        );
        if (!evRows[0]) {
            return res.status(403).json({ success: false, message: 'Event not found or not authorised' });
        }
        const maxCapacity = evRows[0].max_capacity || null;

        const [[summary], [daily], [byTier]] = await Promise.all([
            db.query(
                `SELECT
                    COUNT(*)                        AS tickets_sold,
                    COALESCE(SUM(total_price), 0)   AS revenue,
                    SUM(check_in_status)             AS checked_in
                 FROM ticket_sales WHERE event_id = ?`,
                [event_id]
            ),
            db.query(
                `SELECT
                    DATE(purchased_at) AS date,
                    COUNT(*)           AS tickets,
                    SUM(total_price)   AS revenue
                 FROM ticket_sales
                 WHERE event_id = ?
                   AND purchased_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                 GROUP BY DATE(purchased_at)
                 ORDER BY date ASC`,
                [event_id, days]
            ),
            db.query(
                `SELECT
                    tt.name             AS tier_name,
                    tt.quantity         AS quantity,
                    COUNT(ts.id)        AS sold,
                    COALESCE(SUM(ts.total_price), 0) AS revenue
                 FROM ticket_tiers tt
                 LEFT JOIN ticket_sales ts ON ts.tier_id = tt.id
                 WHERE tt.event_id = ?
                 GROUP BY tt.id, tt.name, tt.quantity
                 ORDER BY sold DESC`,
                [event_id]
            ),
        ]);

        const s = summary[0] || {};
        const byTierFormatted = byTier.map(r => ({
            tier_name: r.tier_name,
            quantity:  Number(r.quantity) || 0,
            sold:      Number(r.sold)     || 0,
            revenue:   Number(r.revenue)  || 0,
        }));
        // Real remaining availability is bounded by ticket-tier inventory, not the
        // event's (often-blank, never enforced) max_capacity field.
        const tierCapacity  = byTierFormatted.reduce((sum, t) => sum + t.quantity, 0);
        const tierRemaining = byTierFormatted.reduce((sum, t) => sum + Math.max(t.quantity - t.sold, 0), 0);

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    tickets_sold:      Number(s.tickets_sold) || 0,
                    revenue:           Number(s.revenue)      || 0,
                    checked_in:        Number(s.checked_in)   || 0,
                    max_capacity:      maxCapacity,
                    tier_capacity:     tierCapacity,
                    tickets_remaining: tierRemaining,
                },
                daily:   daily.map(r => ({ date: r.date, tickets: Number(r.tickets), revenue: Number(r.revenue) })),
                by_tier: byTierFormatted,
            },
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// ─── ORGANISER VERIFICATION ───────────────────────────────────────────────────

// POST /organiser/apply — authenticated
// Schema (run once):
//
// CREATE TABLE IF NOT EXISTS event_organiser_verification (
//   id               INT AUTO_INCREMENT PRIMARY KEY,
//   id_user          INT NOT NULL UNIQUE,
//   org_name         VARCHAR(255) NOT NULL,
//   org_type         ENUM('individual','company','ngo') NOT NULL,
//   phone            VARCHAR(20) NOT NULL,
//   address          TEXT NOT NULL,
//   city             VARCHAR(100) NOT NULL,
//   state            VARCHAR(100) NOT NULL,
//   website          VARCHAR(255),
//   social_instagram VARCHAR(255),
//   social_twitter   VARCHAR(255),
//   id_type          ENUM('national_id','passport','drivers_license','bvn','cac') NOT NULL,
//   id_number        VARCHAR(100) NOT NULL,
//   id_document_url  MEDIUMTEXT,
//   bank_name        VARCHAR(100) NOT NULL,
//   account_number   VARCHAR(20) NOT NULL,
//   account_name     VARCHAR(255) NOT NULL,
//   status           ENUM('pending','approved','rejected') DEFAULT 'pending',
//   rejection_reason TEXT,
//   submitted_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   reviewed_at      TIMESTAMP NULL,
//   FOREIGN KEY (id_user) REFERENCES users(id_user)
// );

app.post('/organiser/apply', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const {
            org_name, org_type, phone, address, city, state,
            website, social_instagram, social_twitter,
            id_type, id_number, id_document_url,
        } = req.body;

        const required = { org_name, org_type, phone, address, city, state, id_type, id_number };
        const missing = Object.keys(required).filter(k => !required[k]);
        if (missing.length) {
            return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
        }

        const id_user = req.payload.aud;

        // Upsert: allow re-submission if previously rejected
        const [existing] = await db.query(
            'SELECT id, status FROM event_organiser_verification WHERE id_user = ?',
            [id_user]
        );

        if (existing.length && existing[0].status === 'pending') {
            return res.status(400).json({ success: false, message: 'Your application is already under review.' });
        }
        if (existing.length && existing[0].status === 'approved') {
            return res.status(400).json({ success: false, message: 'Your account is already verified.' });
        }

        if (existing.length) {
            // Re-submission after rejection
            await db.query(
                `UPDATE event_organiser_verification SET
                    org_name=?, org_type=?, phone=?, address=?, city=?, state=?,
                    website=?, social_instagram=?, social_twitter=?,
                    id_type=?, id_number=?, id_document_url=?,
                    status='pending', rejection_reason=NULL, submitted_at=NOW(), reviewed_at=NULL
                 WHERE id_user=?`,
                [org_name, org_type, phone, address, city, state,
                    website || null, social_instagram || null, social_twitter || null,
                    id_type, id_number, id_document_url || null, id_user]
            );
        } else {
            await db.query(
                `INSERT INTO event_organiser_verification
                    (id_user, org_name, org_type, phone, address, city, state,
                     website, social_instagram, social_twitter,
                     id_type, id_number, id_document_url)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [id_user, org_name, org_type, phone, address, city, state,
                    website || null, social_instagram || null, social_twitter || null,
                    id_type, id_number, id_document_url || null]
            );
        }

        return res.status(200).json({ success: true, message: 'Application submitted successfully. We will review it within 24–48 hours.' });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// GET /organiser/status — authenticated
app.get('/organiser/status', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const id_user = req.payload.aud;
        const [rows] = await db.query(
            `SELECT id, org_name, org_type, status, rejection_reason, submitted_at, reviewed_at
             FROM event_organiser_verification WHERE id_user = ?`,
            [id_user]
        );

        if (rows.length === 0) {
            return res.status(200).json({ success: true, data: null });
        }

        return res.status(200).json({ success: true, data: rows[0] });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// ─── END ORGANISER VERIFICATION ───────────────────────────────────────────────

function formatEvent(row) {
    return {
        id:           row.id_event,
        title:        row.title,
        date:         row.date,
        time:         row.time         || null,
        venue:        row.venue,
        type:         row.type,
        banner_url:   row.banner_url,
        category:     row.category,
        description:  row.description  || null,
        max_capacity: row.max_capacity  ? Number(row.max_capacity) : null,
        status:       row.status,
        id_user:      row.id_user,
        created_at:   row.created_at,
        tickets_sold: Number(row.tickets_sold) || 0,
        revenue:      Number(row.revenue)      || 0,
    };
}

module.exports = app;
