const express = require('express');
const app = express.Router();
const db = require('../config/db.js');
const jwthelper = require('../utils/jwt_helper.js');
const mailer = require('../config/mailer.js');
const { randomUUID } = require('crypto');

async function sendTicketEmail(to, tickets, eventTitle, tierName, eventDate, venue) {
    const codesText = tickets.map(({ code, name }) =>
        `<strong>${name}</strong> — ${code}`
    ).join('<br>');

    const body = `
        You have purchased ${tickets.length} ticket${tickets.length > 1 ? 's' : ''} for <strong>${eventTitle}</strong>.<br><br>
        <strong>Tier:</strong> ${tierName}<br>
        <strong>Date:</strong> ${eventDate || 'TBA'}<br>
        <strong>Venue:</strong> ${venue || 'TBA'}<br><br>
        Your ticket code${tickets.length > 1 ? 's' : ''} (present each separately at the entrance):<br><br>
        ${codesText}
    `;

    await mailer.sendEmailtoUser(
        to,
        `Your ${tickets.length > 1 ? tickets.length + ' tickets' : 'ticket'} for ${eventTitle}`,
        'Booking Confirmed',
        body
    );
}


// ─── Ensure DB tables exist on startup ─────────────────────────────────────
async function ensureTables() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS ticket_tiers (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            event_id    BIGINT NOT NULL,
            name        VARCHAR(100) NOT NULL,
            price       DECIMAL(10,2) NOT NULL DEFAULT 0,
            quantity    INT NOT NULL DEFAULT 0,
            sold        INT NOT NULL DEFAULT 0,
            description TEXT,
            for_sale    TINYINT(1) NOT NULL DEFAULT 1,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS ticket_sales (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            tier_id         INT NOT NULL,
            event_id        BIGINT NOT NULL,
            ticket_code     VARCHAR(50) UNIQUE NOT NULL,
            buyer_name      VARCHAR(200) NOT NULL,
            buyer_email     VARCHAR(200) NOT NULL,
            buyer_phone     VARCHAR(50),
            purchased_by    INT NULL,
            quantity        INT NOT NULL DEFAULT 1,
            total_price     DECIMAL(10,2) NOT NULL DEFAULT 0,
            payment_method  VARCHAR(50),
            payment_status  TINYINT(1) NOT NULL DEFAULT 0,
            check_in_status TINYINT(1) NOT NULL DEFAULT 0,
            qr_data         TEXT,
            purchased_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // purchased_by — the account that bought the ticket, distinct from buyer_name/
    // buyer_email/buyer_phone which now identify the individual attendee that
    // specific ticket is for. Older rows won't have this column yet.
    try {
        await db.query('ALTER TABLE ticket_sales ADD COLUMN purchased_by INT NULL');
    } catch (err) {
        if (!/duplicate column/i.test(err.message)) throw err;
    }

    // One-time backfill for tickets bought before purchased_by existed: best
    // guess is whoever's account email matches the row's buyer_email.
    await db.query(`
        UPDATE ticket_sales ts
        JOIN users u ON u.email = ts.buyer_email
        SET ts.purchased_by = u.id_user
        WHERE ts.purchased_by IS NULL
    `);

    console.log('[Tickets] Tables ready');
}
ensureTables().catch(err => console.error('[Tickets] ensureTables failed:', err.message));

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /events/:id/tickets
app.get('/events/:id/tickets', async (req, res) => {
    try {
        const [tiers] = await db.query(
            `SELECT id, event_id, name, price, quantity, sold,
                    (quantity - sold) AS available, description, for_sale
             FROM ticket_tiers
             WHERE event_id = ?
             ORDER BY price ASC`,
            [req.params.id]
        );
        return res.status(200).json({ success: true, data: tiers });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /tickets/purchase — authenticated (a ticket must belong to an account to show up in My Tickets)
app.post('/tickets/purchase', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const {
            tier_id, event_id, buyer_name, buyer_email,
            buyer_phone, payment_method, quantity = 1,
            attendees = [],
        } = req.body;
        const purchasedBy = req.payload.aud;

        if (!tier_id || !event_id || !buyer_name || !buyer_email) {
            return res.status(400).json({
                success: false,
                message: 'tier_id, event_id, buyer_name and buyer_email are required',
            });
        }

        const [[tiers], [events]] = await Promise.all([
            db.query('SELECT * FROM ticket_tiers WHERE id = ?', [tier_id]),
            db.query('SELECT id_event, title, date, venue FROM events WHERE id_event = ?', [event_id]),
        ]);

        const tier = tiers[0];
        const event = events[0];

        if (!tier)  return res.status(404).json({ success: false, message: 'Ticket tier not found' });
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (String(tier.event_id) !== String(event_id)) {
            return res.status(400).json({ success: false, message: 'Tier does not belong to this event' });
        }
        if (!tier.for_sale) return res.status(400).json({ success: false, message: 'This ticket tier is not available for sale' });

        const available = tier.quantity - tier.sold;
        if (parseInt(quantity) > available) {
            return res.status(400).json({
                success: false,
                message: `Only ${available} ticket(s) remaining for this tier`,
            });
        }

        const qty        = parseInt(quantity);
        const unitPrice  = parseFloat(tier.price);

        const insertedIds = [];
        for (let i = 0; i < qty; i++) {
            const attendee     = attendees[i];
            const attendeeName  = attendee?.name?.trim()  || buyer_name;
            const attendeeEmail = attendee?.email?.trim() || buyer_email;
            const attendeePhone = attendee?.phone?.trim() || buyer_phone;

            const ticketCode = 'KLN-' + randomUUID().replace(/-/g, '').substring(0, 10).toUpperCase();
            const qrData     = `KULUNU-TICKET|${ticketCode}|${event_id}|${tier.name}|${attendeeEmail}`;

            const [result] = await db.query(
                `INSERT INTO ticket_sales
                 (tier_id, event_id, ticket_code, buyer_name, buyer_email, buyer_phone, purchased_by,
                  quantity, total_price, payment_method, payment_status, qr_data)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, ?)`,
                [tier_id, event_id, ticketCode, attendeeName, attendeeEmail,
                 attendeePhone || null, purchasedBy, unitPrice, payment_method || null, qrData]
            );
            insertedIds.push(result.insertId);
        }

        await db.query('UPDATE ticket_tiers SET sold = sold + ? WHERE id = ?', [qty, tier_id]);

        const [tickets] = await db.query(
            `SELECT * FROM ticket_sales WHERE id IN (${insertedIds.map(() => '?').join(',')})`,
            insertedIds
        );

        const ticketCodes = tickets.map(t => t.ticket_code);

        // Each attendee gets only their own ticket(s), sent to their own email —
        // not everything bundled to the purchaser. Non-blocking — purchase
        // succeeds regardless of email delivery.
        const byEmail = new Map();
        for (const t of tickets) {
            const list = byEmail.get(t.buyer_email) || [];
            list.push({ code: t.ticket_code, name: t.buyer_name });
            byEmail.set(t.buyer_email, list);
        }
        for (const [email, emailTickets] of byEmail) {
            sendTicketEmail(email, emailTickets, event.title, tier.name, event.date, event.venue);
        }

        return res.status(200).json({
            success: true,
            data: {
                tickets,
                ticket_codes:   ticketCodes,
                payment_status: false,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/events/:id/tickets
app.get('/admin/events/:id/tickets', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const [tiers] = await db.query(
            `SELECT id, event_id, name, price, quantity, sold,
                    (quantity - sold) AS available, description, for_sale, created_at
             FROM ticket_tiers
             WHERE event_id = ?
             ORDER BY created_at ASC`,
            [req.params.id]
        );
        return res.status(200).json({ success: true, data: tiers });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /admin/events/:id/tickets
app.post('/admin/events/:id/tickets', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const { name, price, quantity, description, for_sale = true } = req.body;
        const event_id = req.params.id;

        if (!name || price === undefined || !quantity) {
            return res.status(400).json({ success: false, message: 'name, price and quantity are required' });
        }

        const [result] = await db.query(
            `INSERT INTO ticket_tiers (event_id, name, price, quantity, description, for_sale)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [event_id, name, parseFloat(price), parseInt(quantity), description || null, for_sale ? 1 : 0]
        );

        const [rows] = await db.query(
            'SELECT *, (quantity - sold) AS available FROM ticket_tiers WHERE id = ?',
            [result.insertId]
        );

        return res.status(200).json({ success: true, data: rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// DELETE /admin/tickets/:id
app.delete('/admin/tickets/:id', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM ticket_tiers WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Tier not found' });

        if (rows[0].sold > 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete a tier that already has sales' });
        }

        await db.query('DELETE FROM ticket_tiers WHERE id = ?', [req.params.id]);
        return res.status(200).json({ success: true, message: 'Tier deleted' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PATCH /admin/tickets/:id — update for_sale, name, price, quantity, or description
app.patch('/admin/tickets/:id', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const { for_sale, name, price, quantity, description } = req.body;
        const updates = [];
        const params  = [];

        if (for_sale    !== undefined) { updates.push('for_sale = ?');    params.push(for_sale ? 1 : 0); }
        if (name        !== undefined) { updates.push('name = ?');        params.push(name); }
        if (price       !== undefined) { updates.push('price = ?');       params.push(parseFloat(price)); }
        if (quantity    !== undefined) { updates.push('quantity = ?');    params.push(parseInt(quantity)); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }

        if (!updates.length) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        params.push(req.params.id);
        await db.query(`UPDATE ticket_tiers SET ${updates.join(', ')} WHERE id = ?`, params);

        const [rows] = await db.query(
            'SELECT *, (quantity - sold) AS available FROM ticket_tiers WHERE id = ?',
            [req.params.id]
        );

        return res.status(200).json({ success: true, data: rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /admin/sold-tickets — all sold tickets across all events
app.get('/admin/sold-tickets', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ts.*, tt.name AS tier_name, tt.price AS tier_price, e.title AS event_title
             FROM ticket_sales ts
             JOIN ticket_tiers tt ON ts.tier_id = tt.id
             JOIN events e        ON ts.event_id = e.id_event
             ORDER BY ts.purchased_at DESC`
        );
        return res.status(200).json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /admin/events/:id/sold-tickets
app.get('/admin/events/:id/sold-tickets', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ts.*, tt.name AS tier_name, tt.price AS tier_price
             FROM ticket_sales ts
             JOIN ticket_tiers tt ON ts.tier_id = tt.id
             WHERE ts.event_id = ?
             ORDER BY ts.purchased_at DESC`,
            [req.params.id]
        );
        return res.status(200).json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /events/:id/attendees — authenticated, owner only
app.get('/events/:id/attendees', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const id_user  = req.payload.aud;
        const event_id = req.params.id;

        // Verify the event belongs to this organizer
        const [events] = await db.query(
            'SELECT id_event FROM events WHERE id_event = ? AND id_user = ?',
            [event_id, id_user]
        );
        if (!events[0]) {
            return res.status(403).json({ success: false, message: 'Event not found or not authorised' });
        }

        const [rows] = await db.query(
            `SELECT
                ts.id,
                ts.ticket_code,
                ts.buyer_name,
                ts.buyer_email,
                ts.buyer_phone,
                ts.total_price,
                ts.payment_status,
                ts.check_in_status,
                ts.purchased_at,
                tt.name  AS tier_name,
                tt.price AS tier_price
             FROM ticket_sales ts
             JOIN ticket_tiers tt ON ts.tier_id = tt.id
             WHERE ts.event_id = ?
             ORDER BY ts.purchased_at DESC`,
            [event_id]
        );

        return res.status(200).json({ success: true, data: rows, total: rows.length });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /my-tickets — returns all tickets purchased by the logged-in user
app.get('/my-tickets', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const id_user = req.payload.aud;

        const [rows] = await db.query(
            `SELECT
                ts.id,
                ts.ticket_code,
                ts.buyer_name,
                ts.buyer_email,
                ts.total_price,
                ts.payment_status,
                ts.check_in_status,
                ts.qr_data,
                ts.purchased_at,
                tt.name        AS tier_name,
                tt.price       AS tier_price,
                e.id_event     AS event_id,
                e.title        AS event_title,
                e.date         AS event_date,
                e.time         AS event_time,
                e.venue        AS event_venue,
                e.banner_url   AS event_banner,
                e.status       AS event_status
             FROM ticket_sales ts
             JOIN ticket_tiers tt ON ts.tier_id  = tt.id
             JOIN events e        ON ts.event_id = e.id_event
             WHERE ts.purchased_by = ?
             ORDER BY ts.purchased_at DESC`,
            [id_user]
        );

        return res.status(200).json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /admin/tickets/:id/check-in
app.post('/admin/tickets/:id/check-in', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM ticket_sales WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Ticket not found' });

        if (rows[0].check_in_status) {
            return res.status(400).json({ success: false, message: 'Ticket already checked in' });
        }

        await db.query('UPDATE ticket_sales SET check_in_status = 1 WHERE id = ?', [req.params.id]);
        return res.status(200).json({ success: true, message: 'Ticket checked in successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /tickets/resolve/:code — public, no auth
// Resolves a ticket_code to its event, so a scan link can redirect a
// non-organiser (or logged-out) viewer straight to the public event page.
app.get('/tickets/resolve/:code', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.id_event AS event_id
             FROM ticket_sales ts
             JOIN events e ON e.id_event = ts.event_id
             WHERE ts.ticket_code = ?`,
            [req.params.code]
        );
        if (!rows[0]) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }
        return res.status(200).json({ success: true, data: { event_id: rows[0].event_id } });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /tickets/checkin-by-code — Auth required, event-owner (or platform admin) only
// Body: { ticket_code: 'KLN-XXXX' }
// Resolves the QR ticket_code to a DB row and checks in atomically.
// Returns ticket info regardless of check-in state so the UI can display it.
app.post('/tickets/checkin-by-code', jwthelper.verifyAccessToken, async (req, res) => {
    try {
        const { ticket_code } = req.body;
        if (!ticket_code) {
            return res.status(400).json({ success: false, message: 'ticket_code is required' });
        }

        const [rows] = await db.query(
            `SELECT
                ts.id,
                ts.ticket_code,
                ts.buyer_name,
                ts.check_in_status,
                ts.payment_status,
                ts.purchased_at,
                tt.name     AS tier_name,
                e.id_event  AS event_id,
                e.id_user   AS event_owner_id,
                e.title     AS event_title,
                e.date      AS event_date,
                e.venue     AS event_venue
             FROM ticket_sales ts
             JOIN ticket_tiers tt ON tt.id  = ts.tier_id
             JOIN events       e  ON e.id_event = ts.event_id
             WHERE ts.ticket_code = ?`,
            [ticket_code]
        );

        if (!rows[0]) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const t = rows[0];

        const id_user = req.payload.aud;
        const isOwner = String(t.event_owner_id) === String(id_user);
        if (!isOwner) {
            const [[requester]] = await db.query('SELECT role FROM users WHERE id_user = ?', [id_user]);
            if (requester?.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorised to check in tickets for this event',
                    event_id: t.event_id,
                });
            }
        }

        const payload = {
            id:                t.id,
            ticket_code:       t.ticket_code,
            buyer_name:        t.buyer_name,
            tier_name:         t.tier_name,
            event_title:       t.event_title,
            event_date:        t.event_date,
            event_venue:       t.event_venue,
            payment_status:    !!t.payment_status,
            check_in_status:   true,
        };

        if (t.check_in_status) {
            return res.status(200).json({
                success:           true,
                already_checked_in: true,
                data:              payload,
            });
        }

        await db.query(
            'UPDATE ticket_sales SET check_in_status = 1 WHERE id = ?',
            [t.id]
        );

        return res.status(200).json({
            success:           true,
            already_checked_in: false,
            data:              payload,
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = app;
