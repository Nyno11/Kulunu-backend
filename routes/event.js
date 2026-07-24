const express = require('express');
const app = express.Router();
const multer = require('multer');
const db = require('../config/db.js');
const jwthelper = require('../utils/jwt_helper.js');
const { uploadToFirebase } = require('../utils/firebase.js');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    },
});

// POST /upload-banner — authenticated, uploads image to Firebase Storage
app.post('/upload-banner', jwthelper.verifyAccessToken, upload.single('banner'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }

        const url = await uploadToFirebase(req.file.buffer, req.file.mimetype, req.file.originalname);
        return res.status(200).json({ success: true, url });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message || 'Upload failed' });
    }
});

// POST /create-event — authenticated
app.post('/create-event', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const { title, date, venue, type, banner_url, category } = req.body;

        if (!title || !date || !venue) {
            return res.status(400).json({
                success: false,
                message: 'title, date, and venue are required'
            });
        }

        const id_user = req.payload.aud;

        const [result] = await db.query(
            `INSERT INTO events (id_user, title, date, venue, type, banner_url, category, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
            [id_user, title, date, venue, type || 'physical', banner_url || null, category || null]
        );

        const [rows] = await db.query(
            'SELECT * FROM events WHERE id_event = ?',
            [result.insertId]
        );

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

// GET /events — public
// ?section=just_added   → 10 most recently created active events
// ?section=upcoming     → next active events ordered by date
// ?section=parties      → active events where category = 'party'
// ?category=<value>     → filter by any category
// no params             → returns all three sections grouped
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
            // Return all three sections in one call for Ticket.html
            const [[justAdded], [upcoming], [parties]] = await Promise.all([
                db.query(
                    `SELECT * FROM events WHERE status = 'active' ORDER BY created_at DESC LIMIT ?`,
                    [cap]
                ),
                db.query(
                    `SELECT * FROM events WHERE status = 'active' AND date >= CURDATE() ORDER BY date ASC LIMIT ?`,
                    [cap]
                ),
                db.query(
                    `SELECT * FROM events WHERE status = 'active' AND category = 'party' ORDER BY date ASC LIMIT ?`,
                    [cap]
                ),
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    just_added: justAdded.map(formatEvent),
                    upcoming: upcoming.map(formatEvent),
                    parties: parties.map(formatEvent),

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
        id: row.id_event,
        title: row.title,
        date: row.date,
        venue: row.venue,
        type: row.type,
        banner_url: row.banner_url,
        category: row.category,
        status: row.status,
        id_user: row.id_user,
        created_at: row.created_at,
        tickets_sold: Number(row.tickets_sold) || 0,
        revenue:      Number(row.revenue)      || 0,
    };
}

module.exports = app;
