# Fleet Manager Feature - Database Migration Guide

This document explains how to set up the database for the Fleet Manager feature.

## Database Changes Required

### 1. Add Fleet Manager Role

Run the following SQL script to add the `fleet_manager` role to the users table:

```sql
-- File: add_fleet_manager_role.sql
ALTER TABLE users 
MODIFY COLUMN role ENUM('shipper', 'trucker', 'fleet_manager', 'admin') NOT NULL;
```

### 2. Create Trucks Table

Run the following SQL script to create the trucks table for fleet managers:

```sql
-- File: create_trucks_table.sql
CREATE TABLE IF NOT EXISTS trucks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fleetManagerId INT NOT NULL,
    plateNumber VARCHAR(50) NOT NULL,
    vehicleType VARCHAR(100) NOT NULL,
    vehicleModel VARCHAR(100) NULL,
    vehicleYear INT NULL,
    capacity DECIMAL(10, 2) NULL COMMENT 'Capacity in tons',
    driverName VARCHAR(255) NULL,
    driverPhone VARCHAR(20) NULL,
    driverLicense VARCHAR(255) NULL,
    vehicleReg VARCHAR(255) NULL,
    status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (fleetManagerId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_fleetManager (fleetManagerId),
    INDEX idx_status (status),
    INDEX idx_plateNumber (plateNumber),
    UNIQUE KEY unique_plate_fleet (plateNumber, fleetManagerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## How to Run Migrations

### Option 1: Using MySQL Command Line

```bash
# Connect to your MySQL database
mysql -u your_username -p holage_db

# Run the migration scripts
source scripts/add_fleet_manager_role.sql
source scripts/create_trucks_table.sql
```

### Option 2: Using a MySQL Client (e.g., phpMyAdmin, MySQL Workbench)

1. Open your MySQL client
2. Select the `holage_db` database
3. Run the SQL scripts from the `scripts` folder:
   - `add_fleet_manager_role.sql`
   - `create_trucks_table.sql`

### Option 3: Using Node.js Script (Recommended)

You can create a migration script that runs these SQL files programmatically:

```javascript
// scripts/run-fleet-manager-migrations.js
import pool from '../config/db.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigrations() {
  try {
    // Read and execute add_fleet_manager_role.sql
    const roleMigration = fs.readFileSync(
      path.join(__dirname, 'add_fleet_manager_role.sql'),
      'utf8'
    )
    await pool.execute(roleMigration)
    console.log('✅ Fleet manager role added successfully')
    
    // Read and execute create_trucks_table.sql
    const trucksMigration = fs.readFileSync(
      path.join(__dirname, 'create_trucks_table.sql'),
      'utf8'
    )
    await pool.execute(trucksMigration)
    console.log('✅ Trucks table created successfully')
    
    console.log('🎉 All migrations completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration error:', error)
    process.exit(1)
  }
}

runMigrations()
```

Then run:
```bash
node scripts/run-fleet-manager-migrations.js
```

## Features Added

1. **Fleet Manager Role**: New user role for managing multiple trucks
2. **Truck Management**: Fleet managers can:
   - Add new trucks to their fleet
   - Edit truck information
   - Delete trucks
   - View all trucks in their fleet
   - Set truck status (active, inactive, maintenance)
3. **Signup Flow**: 
   - Step-by-step signup process
   - Fleet managers must provide NIN and BVN during registration
   - Cleaner, simpler UI for better user experience
4. **Dashboard**: 
   - Fleet Manager Dashboard with truck management
   - View fleet statistics
   - Manage trucks with easy-to-use interface

## API Endpoints

### Trucks Management (Fleet Managers Only)

- `POST /api/trucks` - Create a new truck
- `GET /api/trucks` - Get all trucks for the authenticated fleet manager
- `GET /api/trucks/:truckId` - Get a single truck by ID
- `PUT /api/trucks/:truckId` - Update a truck
- `DELETE /api/trucks/:truckId` - Delete a truck

All endpoints require authentication and the `fleet_manager` role.

## Testing

After running the migrations, you can test the feature by:

1. Registering a new fleet manager account
2. Logging in as a fleet manager
3. Adding trucks to the fleet
4. Viewing and managing trucks in the dashboard

## Notes

- Fleet managers require NIN and BVN for registration
- Each fleet manager can have multiple trucks
- Plate numbers must be unique per fleet manager
- Trucks can have status: active, inactive, or maintenance

