-- ============================================================
-- Migration 001 — Initial schema
-- Database: kulunu
-- Run once on a fresh database to create all baseline tables.
-- Every statement uses IF NOT EXISTS so it is safe to re-run.
-- ============================================================

CREATE DATABASE IF NOT EXISTS kulunu
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE kulunu;

-- ────────────────────────────────────────────────────────────
-- USERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id_user        INT AUTO_INCREMENT PRIMARY KEY,
    full_name      VARCHAR(100)  NOT NULL,
    email          VARCHAR(100)  UNIQUE NOT NULL,
    password_hash  VARCHAR(255)  NOT NULL,
    phone_number   VARCHAR(20),
    role           ENUM('customer','admin','organiser') DEFAULT 'customer',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- PASSWORD RESET TOKENS  (used by /sendresetemail + /resetpassword)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_tokens (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    id_user    INT NOT NULL,
    token      VARCHAR(20)  NOT NULL,
    expires_at DATETIME     NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE CASCADE
);

-- ────────────────────────────────────────────────────────────
-- OTP  (used by /verifyRecOTP)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(100) NOT NULL,
    otp_pass   VARCHAR(20)  NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- EVENTS  (used by /create-event, /events, /admin/events)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id_event   INT AUTO_INCREMENT PRIMARY KEY,
    id_user    INT NOT NULL,
    title      VARCHAR(255) NOT NULL,
    date       DATE         NOT NULL,
    venue      VARCHAR(255) NOT NULL,
    type       VARCHAR(50)  DEFAULT 'physical',
    banner_url TEXT,
    category   VARCHAR(100),
    status     VARCHAR(50)  DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE CASCADE
);

-- ────────────────────────────────────────────────────────────
-- ORGANISER VERIFICATION  (used by /organiser/apply + /organiser/status)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_organiser_verification (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    id_user          INT NOT NULL UNIQUE,
    org_name         VARCHAR(255) NOT NULL,
    org_type         ENUM('individual','company','ngo') NOT NULL,
    phone            VARCHAR(20)  NOT NULL,
    address          TEXT         NOT NULL,
    city             VARCHAR(100) NOT NULL,
    state            VARCHAR(100) NOT NULL,
    website          VARCHAR(255),
    social_instagram VARCHAR(255),
    social_twitter   VARCHAR(255),
    id_type          ENUM('national_id','passport','drivers_license','bvn','cac') NOT NULL,
    id_number        VARCHAR(100) NOT NULL,
    id_document_url  MEDIUMTEXT,
    bank_name        VARCHAR(100),
    account_number   VARCHAR(20),
    account_name     VARCHAR(255),
    status           ENUM('pending','approved','rejected') DEFAULT 'pending',
    rejection_reason TEXT,
    submitted_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at      TIMESTAMP NULL,
    FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE CASCADE
);
