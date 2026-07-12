-- ============================================================
-- Migration 002 — Ticket system tables
-- Depends on: 001_initial_schema.sql  (events table must exist)
-- Run after 001, or run standalone on a DB that already has
-- the events table.
-- ============================================================

USE kulunu;

-- ────────────────────────────────────────────────────────────
-- TICKET TIERS
-- One row per tier per event (e.g. VIP, Regular, Early Bird).
-- No FK to events so this migration is safe even if the events
-- table uses a different column type for its PK.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_tiers (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    event_id    INT          NOT NULL,          -- mirrors events.id_event
    name        VARCHAR(100) NOT NULL,
    price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    quantity    INT          NOT NULL DEFAULT 0,
    sold        INT          NOT NULL DEFAULT 0,
    description TEXT,
    for_sale    TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_tt_event (event_id)
);

-- ────────────────────────────────────────────────────────────
-- TICKET SALES
-- One row per purchase transaction (may cover multiple tickets
-- via the quantity column).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_sales (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    tier_id         INT          NOT NULL,      -- ticket_tiers.id
    event_id        INT          NOT NULL,      -- mirrors events.id_event
    ticket_code     VARCHAR(50)  UNIQUE NOT NULL,
    buyer_name      VARCHAR(200) NOT NULL,
    buyer_email     VARCHAR(200) NOT NULL,
    buyer_phone     VARCHAR(50),
    quantity        INT          NOT NULL DEFAULT 1,
    total_price     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_method  VARCHAR(50),
    payment_status  TINYINT(1)   NOT NULL DEFAULT 0,   -- 0 = pending, 1 = paid
    check_in_status TINYINT(1)   NOT NULL DEFAULT 0,   -- 0 = not checked in, 1 = checked in
    qr_data         TEXT,
    purchased_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_ts_tier    (tier_id),
    INDEX idx_ts_event   (event_id),
    INDEX idx_ts_email   (buyer_email),
    INDEX idx_ts_code    (ticket_code)
);
