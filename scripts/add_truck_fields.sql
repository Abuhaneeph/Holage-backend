-- Add new fields to trucks table for enhanced truck information
-- Note: Run this script only if the columns don't already exist
-- If columns already exist, you'll get an error which you can safely ignore

ALTER TABLE trucks
ADD COLUMN product VARCHAR(255) NULL COMMENT 'Product/service type the truck usually carries';

ALTER TABLE trucks
ADD COLUMN description TEXT NULL COMMENT 'Description of the truck';

ALTER TABLE trucks
ADD COLUMN type VARCHAR(100) NULL COMMENT 'Type of truck (e.g., flatbed, tanker, trailer, tipper)';

ALTER TABLE trucks
ADD COLUMN color VARCHAR(50) NULL COMMENT 'Color of the truck';

ALTER TABLE trucks
ADD COLUMN imageUrl VARCHAR(500) NULL COMMENT 'URL of the truck picture';

ALTER TABLE trucks
ADD COLUMN notes TEXT NULL COMMENT 'Additional notes about the truck';

