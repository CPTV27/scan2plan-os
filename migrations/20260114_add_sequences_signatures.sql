-- Migration: Add missing tables and columns
-- Date: 2026-01-14
-- Description: Add sequences tables, signature columns on cpq_quotes, and mauticContactId on leads

-- ============================================
-- 1. MARKETING SEQUENCES TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS sequences (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT DEFAULT 'manual',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequence_steps (
    id SERIAL PRIMARY KEY,
    sequence_id INTEGER NOT NULL REFERENCES sequences(id),
    step_order INTEGER NOT NULL,
    delay_days INTEGER DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'email',
    subject TEXT,
    content TEXT,
    template_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    sequence_id INTEGER NOT NULL REFERENCES sequences(id),
    current_step INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    next_execution_at TIMESTAMP,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- ============================================
-- 2. E-SIGNATURE COLUMNS ON CPQ_QUOTES
-- ============================================

-- Add signature columns if they don't exist
ALTER TABLE cpq_quotes ADD COLUMN IF NOT EXISTS signature_provider TEXT;
ALTER TABLE cpq_quotes ADD COLUMN IF NOT EXISTS signature_submission_id TEXT;
ALTER TABLE cpq_quotes ADD COLUMN IF NOT EXISTS signature_status TEXT;
ALTER TABLE cpq_quotes ADD COLUMN IF NOT EXISTS signature_sent_at TIMESTAMP;
ALTER TABLE cpq_quotes ADD COLUMN IF NOT EXISTS signature_signed_at TIMESTAMP;

-- ============================================
-- 3. MAUTIC CONTACT ID ON LEADS
-- ============================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS mautic_contact_id TEXT;

-- ============================================
-- DONE
-- ============================================

-- Run this SQL in your database to sync schema with code
-- In Replit Shell: DATABASE_URL=... psql -f migrations/20260114_add_sequences_signatures.sql
