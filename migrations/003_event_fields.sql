-- ============================================================
-- Migration 003 — Add description, time, max_capacity to events
-- ============================================================

ALTER TABLE events
    ADD COLUMN description  TEXT         NULL,
    ADD COLUMN time         TIME         NULL,
    ADD COLUMN max_capacity INT UNSIGNED NULL;
