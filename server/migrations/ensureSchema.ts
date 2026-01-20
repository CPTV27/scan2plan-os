import { pool } from "../db";

export async function ensureSchemaColumns(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    await client.query(`
      ALTER TABLE public.products 
      ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Service',
      ADD COLUMN IF NOT EXISTS price DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pricing_model TEXT DEFAULT 'Fixed',
      ADD COLUMN IF NOT EXISTS attributes JSONB,
      ADD COLUMN IF NOT EXISTS qbo_item_id TEXT,
      ADD COLUMN IF NOT EXISTS qbo_account_name TEXT,
      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);
    
    await client.query(`
      ALTER TABLE public.cpq_quotes 
      ADD COLUMN IF NOT EXISTS signature_provider TEXT,
      ADD COLUMN IF NOT EXISTS signature_submission_id TEXT,
      ADD COLUMN IF NOT EXISTS signature_status TEXT,
      ADD COLUMN IF NOT EXISTS signature_sent_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS signature_signed_at TIMESTAMP;
    `);
    
    await client.query(`
      ALTER TABLE public.leads 
      ADD COLUMN IF NOT EXISTS signature_image TEXT,
      ADD COLUMN IF NOT EXISTS signer_name TEXT,
      ADD COLUMN IF NOT EXISTS signer_email TEXT,
      ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP;
    `);
    
    await client.query('COMMIT');
    console.log('[Migrations] Schema columns ensured successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migrations] Error ensuring schema columns:', error);
    throw error;
  } finally {
    client.release();
  }
}
