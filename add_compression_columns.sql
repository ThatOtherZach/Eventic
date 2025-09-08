-- Add compression tracking columns to registry_records table
ALTER TABLE registry_records 
ADD COLUMN IF NOT EXISTS is_compressed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS compression_date TIMESTAMP;
