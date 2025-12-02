import pool from "../config/db.js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function updateShipmentStatusEnum() {
  try {
    const sqlFile = path.join(__dirname, "update_shipment_status_enum.sql")
    const sql = fs.readFileSync(sqlFile, "utf8")
    
    // Split by semicolon and filter out empty statements
    const statements = sql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"))
    
    console.log("🔄 Updating shipment status ENUM...")
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.execute(statement)
        console.log("✅ Executed:", statement.substring(0, 50) + "...")
      }
    }
    
    console.log("\n✅ Shipment status ENUM updated successfully!")
    console.log("   New statuses: pending, assigned, picking_up, picked_up, in_transit, delivered, cancelled")
    
    process.exit(0)
  } catch (error) {
    console.error("❌ Error updating shipment status ENUM:", error)
    process.exit(1)
  }
}

updateShipmentStatusEnum()

