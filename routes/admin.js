const express = require('express');
const app     = express.Router();
const db      = require('../config/db.js');
const jwthelper = require('../utils/jwt_helper.js');
const mailer    = require('../config/mailer.js');

// Middleware: verify JWT then confirm the user has role='admin'
async function requireAdmin(req, res, next) {
    try {
        await new Promise((resolve, reject) =>
            jwthelper.verifyAccessToken(req, res, (err) => (err ? reject(err) : resolve()))
        );
        const [rows] = await db.query(
            'SELECT role FROM users WHERE id_user = ?',
            [req.payload.aud]
        );
        if (!rows[0] || rows[0].role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Unauthorised' });
    }
}

// ─── GET /admin/organisers ──────────────────────────────────────────────────
// List all organiser applications.
// ?status=pending|approved|rejected   (default: all)
// ?page=1&limit=20
app.get('/admin/organisers', requireAdmin, async (req, res) => {
    try {
        const status = req.query.status;
        const limit  = Math.min(Number(req.query.limit) || 20, 100);
        const offset = (Math.max(Number(req.query.page) || 1, 1) - 1) * limit;

        const allowed = ['pending', 'approved', 'rejected'];
        const useFilter = allowed.includes(status);

        const [rows] = await db.query(
            `SELECT
                v.id,
                v.id_user,
                u.full_name,
                u.email,
                u.phone_number,
                v.org_name,
                v.org_type,
                v.phone,
                v.address,
                v.city,
                v.state,
                v.website,
                v.social_instagram,
                v.social_twitter,
                v.id_type,
                v.id_number,
                v.id_document_url,
                v.bank_name,
                v.account_number,
                v.account_name,
                v.status,
                v.rejection_reason,
                v.submitted_at,
                v.reviewed_at
             FROM event_organiser_verification v
             JOIN users u ON u.id_user = v.id_user
             ${useFilter ? 'WHERE v.status = ?' : ''}
             ORDER BY
               CASE v.status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
               v.submitted_at DESC
             LIMIT ? OFFSET ?`,
            useFilter ? [status, limit, offset] : [limit, offset]
        );

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM event_organiser_verification
             ${useFilter ? 'WHERE status = ?' : ''}`,
            useFilter ? [status] : []
        );

        return res.status(200).json({
            success: true,
            data: rows,
            meta: { total, limit, offset },
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// ─── PATCH /admin/organisers/:id ───────────────────────────────────────────
// Approve or reject an organiser application.
// Body: { action: 'approve' | 'reject', reason?: string }
// On approve: sets users.role = 'organiser'
// On reject:  stores rejection_reason, leaves role unchanged
app.patch('/admin/organisers/:id', requireAdmin, async (req, res) => {
    try {
        const appId  = req.params.id;
        const action = req.body.action;
        const reason = req.body.reason || null;

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ success: false, message: "action must be 'approve' or 'reject'" });
        }
        if (action === 'reject' && !reason) {
            return res.status(400).json({ success: false, message: 'A rejection reason is required' });
        }

        const [rows] = await db.query(
            'SELECT id, id_user, status FROM event_organiser_verification WHERE id = ?',
            [appId]
        );
        if (!rows[0]) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }
        const application = rows[0];

        if (application.status === 'approved' && action === 'approve') {
            return res.status(400).json({ success: false, message: 'Application is already approved' });
        }

        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        await db.query(
            `UPDATE event_organiser_verification
             SET status = ?, rejection_reason = ?, reviewed_at = NOW()
             WHERE id = ?`,
            [newStatus, action === 'reject' ? reason : null, appId]
        );

        if (action === 'approve') {
            await db.query(
                "UPDATE users SET role = 'organiser' WHERE id_user = ?",
                [application.id_user]
            );
        }

        // Non-blocking notification email to the applicant
        const [[user]] = await db.query(
            'SELECT full_name, email FROM users WHERE id_user = ?',
            [application.id_user]
        ).catch(() => [[null]]);

        if (user) {
            const subject = action === 'approve'
                ? 'Your organiser application has been approved!'
                : 'Update on your organiser application';
            const body = action === 'approve'
                ? `Hi ${user.full_name},\n\nGreat news! Your organiser application has been approved. You can now create and manage events on Kulunu.\n\nWelcome aboard!`
                : `Hi ${user.full_name},\n\nWe reviewed your organiser application and unfortunately could not approve it at this time.\n\nReason: ${reason}\n\nYou are welcome to re-apply after addressing the feedback above.`;
            mailer.sendEmailtoUser(user.email, subject, subject, body).catch(() => {});
        }

        return res.status(200).json({
            success: true,
            message: `Application ${newStatus} successfully`,
            data: { id: Number(appId), status: newStatus },
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

module.exports = app;
