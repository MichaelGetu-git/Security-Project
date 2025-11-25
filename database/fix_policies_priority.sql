-- Add priority column to policies table if it doesn't exist
ALTER TABLE policies ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Update existing policies to have priority based on id
UPDATE policies SET priority = id WHERE priority IS NULL OR priority = 0;


