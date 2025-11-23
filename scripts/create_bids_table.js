import pool from "../config/db.js"

async function createBidsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS shipment_bids (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shipmentId INT NOT NULL,
        truckerId INT NOT NULL,
        bidAmount DECIMAL(10, 2) NOT NULL,
        status ENUM('pending', 'accepted', 'rejected', 'cancelled') DEFAULT 'pending',
        message TEXT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        acceptedAt TIMESTAMP DEFAULT NULL,
        FOREIGN KEY (shipmentId) REFERENCES shipments(id) ON DELETE CASCADE,
        FOREIGN KEY (truckerId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_shipment (shipmentId),
        INDEX idx_trucker (truckerId),
        INDEX idx_status (status),
        INDEX idx_created (createdAt),
        UNIQUE KEY unique_trucker_shipment (truckerId, shipmentId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `

    await pool.execute(createTableQuery)
    console.log("✅ Shipment bids table created successfully!")
    
    // Show table structure
    const [columns] = await pool.execute("DESCRIBE shipment_bids")
    console.log("\nTable structure:")
    console.table(columns)
    
    process.exit(0)
  } catch (error) {
    console.error("❌ Error creating shipment bids table:", error)
    process.exit(1)
  }
}

createBidsTable()

