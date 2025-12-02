import pool from "../config/db.js"

async function checkAndFixShipmentStatus() {
  try {
    // Check current ENUM values
    console.log("🔍 Checking current shipment status ENUM...")
    const [columns] = await pool.execute("SHOW COLUMNS FROM shipments WHERE Field = 'status'")
    
    if (columns.length === 0) {
      console.error("❌ Status column not found!")
      process.exit(1)
    }
    
    const column = columns[0]
    console.log("Current status column definition:")
    console.log(column)
    
    // Extract current ENUM values
    const currentType = column.Type
    console.log("\n📋 Current ENUM values:", currentType)
    
    // Check if picking_up and picked_up are in the ENUM
    const hasPickingUp = currentType.includes("picking_up")
    const hasPickedUp = currentType.includes("picked_up")
    
    if (hasPickingUp && hasPickedUp) {
      console.log("✅ ENUM already includes 'picking_up' and 'picked_up'")
      console.log("   The issue might be something else. Let's verify...")
    } else {
      console.log("❌ ENUM is missing required values!")
      console.log("   Has 'picking_up':", hasPickingUp)
      console.log("   Has 'picked_up':", hasPickedUp)
      
      console.log("\n🔄 Updating ENUM to include all required values...")
      
      // Update the ENUM
      const updateQuery = `
        ALTER TABLE shipments
        MODIFY COLUMN status ENUM('pending', 'assigned', 'picking_up', 'picked_up', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending'
      `
      
      await pool.execute(updateQuery)
      console.log("✅ ENUM updated successfully!")
      
      // Verify the update
      const [updatedColumns] = await pool.execute("SHOW COLUMNS FROM shipments WHERE Field = 'status'")
      console.log("\n📋 Updated ENUM values:", updatedColumns[0].Type)
    }
    
    // Test by checking if we can query with the new statuses
    console.log("\n🧪 Testing status values...")
    const testStatuses = ['picking_up', 'picked_up', 'in_transit']
    for (const testStatus of testStatuses) {
      try {
        const [testResult] = await pool.execute(
          "SELECT COUNT(*) as count FROM shipments WHERE status = ?",
          [testStatus]
        )
        console.log(`   ✓ '${testStatus}' is valid (found ${testResult[0].count} shipments)`)
      } catch (err) {
        console.log(`   ✗ '${testStatus}' is NOT valid:`, err.message)
      }
    }
    
    console.log("\n✅ Check complete!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error:", error)
    process.exit(1)
  }
}

checkAndFixShipmentStatus()

