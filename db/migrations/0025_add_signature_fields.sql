-- Add signature fields to leads table for open-source signature capture
-- Replaces PandaDoc dependency with react-signature-canvas

ALTER TABLE leads ADD COLUMN IF NOT EXISTS signature_image TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS signer_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS signer_email TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP;

COMMENT ON COLUMN leads.signature_image IS 'Base64 PNG of client signature';
COMMENT ON COLUMN leads.signer_name IS 'Full name of person who signed the proposal';
COMMENT ON COLUMN leads.signer_email IS 'Email address of person who signed';
COMMENT ON COLUMN leads.signed_at IS 'Timestamp when proposal was signed';
