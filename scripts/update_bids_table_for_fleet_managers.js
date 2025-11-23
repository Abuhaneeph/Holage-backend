import pool from "../config/db.js"

async function updateBidsTable() {
  try {
    console.log("🔄 Updating shipment_bids table for fleet managers...")

    // 1. Modify truckerId to allow NULL
    try {
      await pool.execute(`
        ALTER TABLE shipment_bids 
        MODIFY COLUMN truckerId INT NULL
      `)
      console.log("✅ Modified truckerId to allow NULL")
    } catch (error) {
      if (error.code !== 'ER_BAD_FIELD_ERROR') {
        console.log("⚠️  truckerId modification:", error.message)
      }
    }

    // 2. Check and add driverId column
    const [driverIdCheck] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'shipment_bids' 
      AND COLUMN_NAME = 'driverId'
    `)
    
    if (driverIdCheck[0].count === 0) {
      await pool.execute(`
        ALTER TABLE shipment_bids 
        ADD COLUMN driverId INT NULL
      `)
      console.log("✅ Added driverId column")
    } else {
      console.log("ℹ️  driverId column already exists")
    }

    // 3. Check and add fleetManagerId column
    const [fleetManagerIdCheck] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'shipment_bids' 
      AND COLUMN_NAME = 'fleetManagerId'
    `)
    
    if (fleetManagerIdCheck[0].count === 0) {
      await pool.execute(`
        ALTER TABLE shipment_bids 
        ADD COLUMN fleetManagerId INT NULL
      `)
      console.log("✅ Added fleetManagerId column")
    } else {
      console.log("ℹ️  fleetManagerId column already exists")
    }

    // 4. Check and add foreign key for driverId
    const [fkDriverCheck] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'shipment_bids' 
      AND CONSTRAINT_NAME = 'shipment_bids_ibfk_driver'
    `)
    
    if (fkDriverCheck[0].count === 0) {
      await pool.execute(`
        ALTER TABLE shipment_bids 
        ADD CONSTRAINT shipment_bids_ibfk_driver 
        FOREIGN KEY (driverId) REFERENCES drivers(id) ON DELETE SET NULL
      `)
      console.log("✅ Added foreign key for driverId")
    } else {
      console.log("ℹ️  Foreign key for driverId already exists")
    }

    // 5. Check and add foreign key for fleetManagerId
    const [fkFleetManagerCheck] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'shipment_bids' 
      AND CONSTRAINT_NAME = 'shipment_bids_ibfk_fleetmanager'
    `)
    
    if (fkFleetManagerCheck[0].count === 0) {
      await pool.execute(`
        ALTER TABLE shipment_bids 
        ADD CONSTRAINT shipment_bids_ibfk_fleetmanager 
        FOREIGN KEY (fleetManagerId) REFERENCES users(id) ON DELETE SET NULL
      `)
      console.log("✅ Added foreign key for fleetManagerId")
    } else {
      console.log("ℹ️  Foreign key for fleetManagerId already exists")
    }

    // 6. Check and add index for driverId
    const [idxDriverCheck] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'shipment_bids' 
      AND INDEX_NAME = 'idx_driver'
    `)
    
    if (idxDriverCheck[0].count === 0) {
      await pool.execute(`
        ALTER TABLE shipment_bids 
        ADD INDEX idx_driver (driverId)
      `)
      console.log("✅ Added index for driverId")
    } else {
      console.log("ℹ️  Index for driverId already exists")
    }

    // 7. Check and add index for fleetManagerId
    const [idxFleetManagerCheck] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'shipment_bids' 
      AND INDEX_NAME = 'idx_fleetManager'
    `)
    
    if (idxFleetManagerCheck[0].count === 0) {
      await pool.execute(`
        ALTER TABLE shipment_bids 
        ADD INDEX idx_fleetManager (fleetManagerId)
      `)
      console.log("✅ Added index for fleetManagerId")
    } else {
      console.log("ℹ️  Index for fleetManagerId already exists")
    }

    // 8. Check and remove unique constraint on truckerId
    const [uniqueTruckerCheck] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'shipment_bids' 
      AND INDEX_NAME = 'unique_trucker_shipment'
    `)
    
    if (uniqueTruckerCheck[0].count > 0) {
      await pool.execute(`
        ALTER TABLE shipment_bids 
        DROP INDEX unique_trucker_shipment
      `)
      console.log("✅ Removed unique constraint on truckerId")
    } else {
      console.log("ℹ️  Unique constraint on truckerId doesn't exist")
    }

    // 9. Check and add unique constraint for fleet manager + driver + shipment
    const [uniqueFleetDriverCheck] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'shipment_bids' 
      AND INDEX_NAME = 'unique_fleet_driver_shipment'
    `)
    
    if (uniqueFleetDriverCheck[0].count === 0) {
      await pool.execute(`
        ALTER TABLE shipment_bids 
        ADD UNIQUE KEY unique_fleet_driver_shipment (fleetManagerId, driverId, shipmentId)
      `)
      console.log("✅ Added unique constraint for fleet manager + driver + shipment")
    } else {
      console.log("ℹ️  Unique constraint for fleet manager + driver + shipment already exists")
    }

    console.log("\n🎉 Successfully updated shipment_bids table!")
    
    // Show table structure
    const [columns] = await pool.execute("DESCRIBE shipment_bids")
    console.log("\nTable structure:")
    console.table(columns)

    process.exit(0)
  } catch (error) {
    console.error("❌ Error updating shipment_bids table:", error)
    process.exit(1)
  }
}

updateBidsTable()

