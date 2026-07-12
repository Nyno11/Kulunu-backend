const express = require('express');
const app = express.Router();
const db = require('../config/db.js');
const jwthelper = require('../utils/jwt_helper.js');
const nodemailer = require('nodemailer');
const { randomUUID } = require('crypto');

// ─── Email transporter ─────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT || '587'),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

async function sendTicketEmail(to, ticketCode, eventTitle, tierName, quantity, eventDate, venue) {
    try {
        await mailer.sendMail({
            from: process.env.MAIL_FROM || process.env.MAIL_USER,
            to,
            subject: `Your ticket for ${eventTitle} — ${ticketCode}`,
            html: `
                <div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:auto;padding:32px;border-radius:12px;border:1px solid #e5e7eb">
                    <h2 style="color:#0b2030;margin-bottom:4px">Booking Confirmed! 🎉</h2>
                    <p style="color:#555">Thank you for your purchase. Here are your ticket details:</p>
                    <table style="border-collapse:collapse;width:100%;margin-top:16px">
                        <tr><td style="padding:8px 0;color:#888;width:120px">Event</td><td style="padding:8px 0;font-weight:600">${eventTitle}</td></tr>
                        <tr><td style="padding:8px 0;color:#888">Tier</td><td style="padding:8px 0">${tierName}</td></tr>
                        <tr><td style="padding:8px 0;color:#888">Quantity</td><td style="padding:8px 0">${quantity}</td></tr>
                        <tr><td style="padding:8px 0;color:#888">Date</td><td style="padding:8px 0">${eventDate || 'TBA'}</td></tr>
                        <tr><td style="padding:8px 0;color:#888">Venue</td><td style="padding:8px 0">${venue || 'TBA'}</td></tr>
                    </table>
                    <div style="margin-top:20px;background:#f0f9ff;border-radius:10px;padding:16px;text-align:center">
                        <p style="margin:0;color:#555;font-size:13px">Your ticket code</p>
                        <p style="margin:8px 0 0;font-size:22px;font-weight:700;letter-spacing:2px;color:#0CA6EF">${ticketCode}</p>
                    </div>
                    <p style="margin-top:20px;color:#555;font-size:13px">Present this code or your QR code at the event entrance.</p>
                    <p style="color:#555;font-size:13px">See you there! — The Kulunu Team</p>
                </div>
            `,
        });
    } catch (err) {
        console.error('[Ticket Email] Failed to send to', to, ':', err.message);
    }
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
            quantity        INT NOT NULL DEFAULT 1,
            total_price     DECIMAL(10,2) NOT NULL DEFAULT 0,
            payment_method  VARCHAR(50),
            payment_status  TINYINT(1) NOT NULL DEFAULT 0,
            check_in_status TINYINT(1) NOT NULL DEFAULT 0,
            qr_data         TEXT,
            purchased_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
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

// POST /tickets/purchase
app.post('/tickets/purchase', async (req, res) => {
    try {
        const {
            tier_id, event_id, buyer_name, buyer_email,
            buyer_phone, payment_method, quantity = 1,
        } = req.body;

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

        const ticketCode  = 'KLN-' + randomUUID().replace(/-/g, '').substring(0, 10).toUpperCase();
        const qrData      = `KULUNU-TICKET|${ticketCode}|${event_id}|${tier.name}|${buyer_email}`;
        const totalPrice  = parseFloat(tier.price) * parseInt(quantity);

        const [result] = await db.query(
            `INSERT INTO ticket_sales
             (tier_id, event_id, ticket_code, buyer_name, buyer_email, buyer_phone,
              quantity, total_price, payment_method, payment_status, qr_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [tier_id, event_id, ticketCode, buyer_name, buyer_email,
             buyer_phone || null, parseInt(quantity), totalPrice,
             payment_method || null, qrData]
        );

        await db.query('UPDATE ticket_tiers SET sold = sold + ? WHERE id = ?', [parseInt(quantity), tier_id]);

        const [rows] = await db.query('SELECT * FROM ticket_sales WHERE id = ?', [result.insertId]);

        // Non-blocking — purchase succeeds regardless of email
        sendTicketEmail(buyer_email, ticketCode, event.title, tier.name, quantity, event.date, event.venue);

        return res.status(200).json({
            success: true,
            data: {
                ticket_code:    ticketCode,
                qr_data:        qrData,
                payment_status: false,
                ticket:         rows[0],
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

module.exports = app;
