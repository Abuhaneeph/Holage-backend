import pool from "../config/db.js"

async function createDriversTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS drivers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fleetManagerId INT NOT NULL,
        driverName VARCHAR(255) NOT NULL,
        phoneNumber VARCHAR(20) NOT NULL,
        driverLicense VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (fleetManagerId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_fleetManager (fleetManagerId),
        INDEX idx_phone (phoneNumber),
        UNIQUE KEY unique_phone (phoneNumber)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `

    await pool.execute(createTableQuery)
    console.log("✅ Drivers table created successfully!")
    
    // Show table structure
    const [columns] = await pool.execute("DESCRIBE drivers")
    console.log("\nTable structure:")
    console.table(columns)
    
    process.exit(0)
  } catch (error) {
    console.error("❌ Error creating drivers table:", error)
    process.exit(1)
  }
}

createDriversTable()

