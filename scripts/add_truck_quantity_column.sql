-- Add quantity column to trucks table to support multiple units of same type
ALTER TABLE trucks 
ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1 COMMENT 'Number of units of this truck type';

