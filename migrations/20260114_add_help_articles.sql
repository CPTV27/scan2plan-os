-- Migration: Add help_articles table for editable Help Center
-- Run with: psql $DATABASE_URL -f migrations/20260114_add_help_articles.sql

-- Create help_articles table
CREATE TABLE IF NOT EXISTS help_articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_help_articles_slug ON help_articles(slug);

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS idx_help_articles_category ON help_articles(category);
