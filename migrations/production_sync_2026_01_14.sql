-- ================================================
-- COMPLETE Production Database Sync Migration
-- Run this in Neon production database console
-- Date: 2026-01-14
-- ================================================

BEGIN;

-- ================================================
-- 1. CPQ_QUOTES - E-Signature Fields
-- ================================================
ALTER TABLE cpq_quotes ADD COLUMN IF NOT EXISTS signature_provider TEXT;
ALTER TABLE cpq_quotes ADD COLUMN IF NOT EXISTS signature_submission_id TEXT;
ALTER TABLE cpq_quotes ADD COLUMN IF NOT EXISTS signature_status TEXT;
ALTER TABLE cpq_quotes ADD COLUMN IF NOT EXISTS signature_sent_at TIMESTAMP;
ALTER TABLE cpq_quotes ADD COLUMN IF NOT EXISTS signature_signed_at TIMESTAMP;
ALTER TABLE cpq_quotes ADD COLUMN IF NOT EXISTS field_affirmations JSONB;

-- ================================================
-- 2. PRODUCTS - Catalog Enhancement Fields
-- ================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Service';
ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_model TEXT DEFAULT 'Fixed';
ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB;

-- ================================================
-- 3. AI RESEARCH MEMORY (New Table)
-- ================================================
CREATE TABLE IF NOT EXISTS ai_research_memory (
    id SERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    details JSONB,
    source_type TEXT,
    source_url TEXT,
    source_id INTEGER,
    confidence INTEGER DEFAULT 70,
    citation_count INTEGER DEFAULT 0,
    last_cited_at TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by TEXT,
    verified_at TIMESTAMP,
    expires_at TIMESTAMP,
    tags JSONB DEFAULT '[]',
    related_memory_ids JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- 4. AI LEARNING LOGS (New Table)
-- ================================================
CREATE TABLE IF NOT EXISTS ai_learning_logs (
    id SERIAL PRIMARY KEY,
    agent TEXT NOT NULL,
    interaction_type TEXT NOT NULL,
    interaction_id INTEGER,
    learned_facts JSONB,
    confidence_delta INTEGER,
    applied_to_memory_ids JSONB,
    reasoning TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- 5. AI FACT CITATIONS (New Table)
-- ================================================
CREATE TABLE IF NOT EXISTS ai_fact_citations (
    id SERIAL PRIMARY KEY,
    memory_id INTEGER NOT NULL,
    agent TEXT NOT NULL,
    context TEXT,
    used_in_output_id INTEGER,
    was_helpful BOOLEAN,
    feedback TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- 6. BUYER PERSONAS - Check for missing columns
-- ================================================
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5, 2);
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS deal_count INTEGER DEFAULT 0;
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS win_count INTEGER DEFAULT 0;
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS loss_count INTEGER DEFAULT 0;

-- ================================================
-- 7. LEADS - Check for common missing columns
-- ================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mautic_contact_id INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_scoring_data JSONB;

-- ================================================
-- 8. AGENT PROMPTS - Check columns
-- ================================================
ALTER TABLE agent_prompts ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ================================================
-- 9. MARKETING INTEL (New Table if missing)
-- ================================================
CREATE TABLE IF NOT EXISTS marketing_intel (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    insights JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',
    related_leads JSONB,
    related_projects JSONB,
    confidence INTEGER DEFAULT 50,
    source TEXT,
    metadata JSONB,
    is_actioned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- ================================================
-- 10. VERIFY ALL CHANGES
-- ================================================
SELECT 'cpq_quotes signature columns:' as check_type, 
       count(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'cpq_quotes' 
AND column_name LIKE 'signature%';

SELECT 'products catalog columns:' as check_type, 
       count(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('type', 'price', 'pricing_model', 'attributes');

SELECT 'AI tables:' as check_type,
       table_name
FROM information_schema.tables 
WHERE table_name LIKE 'ai_%';

COMMIT;
