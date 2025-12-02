-- Clean up "00" and "0" LGA values in shipments table
-- Set them to NULL instead

UPDATE shipments 
SET pickupLga = NULL 
WHERE pickupLga = '00' OR pickupLga = '0' OR pickupLga = '';

UPDATE shipments 
SET destinationLga = NULL 
WHERE destinationLga = '00' OR destinationLga = '0' OR destinationLga = '';

-- Show affected rows
SELECT 
  COUNT(*) as total_shipments,
  SUM(CASE WHEN pickupLga IS NULL THEN 1 ELSE 0 END) as null_pickup_lga,
  SUM(CASE WHEN destinationLga IS NULL THEN 1 ELSE 0 END) as null_destination_lga
FROM shipments;

