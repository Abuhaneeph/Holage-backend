import pool from "../config/db.js"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config()

const runMigration = async () => {
  let connection
  try {
    console.log("🔄 Running truck fields migration...")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Get a connection from the pool
    connection = await pool.getConnection()

    // Read the SQL file
    const sqlFilePath = join(__dirname, "add_truck_fields.sql")
    const sql = readFileSync(sqlFilePath, "utf8")

    // Remove comments and split by semicolon
    const cleanedSql = sql
      .split("\n")
      .filter(line => !line.trim().startsWith("--") || line.trim() === "")
      .join("\n")

    // Split by semicolon
    const statements = cleanedSql
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)

    console.log(`📝 Found ${statements.length} SQL statement(s) to execute\n`)

    // Execute each statement sequentially
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement || statement.length === 0) continue

      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`)
        
        // Check if columns already exist
        if (statement.toUpperCase().includes("ADD COLUMN")) {
          const columnMatch = statement.match(/ADD COLUMN\s+(\w+)/i)
          if (columnMatch) {
            const columnName = columnMatch[1]
            const [existing] = await connection.execute(
              `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'trucks' AND COLUMN_NAME = ?`,
              [process.env.DB_DATABASE || "holage_db", columnName]
            )

            if (existing.length > 0) {
              console.log(`⚠️  Column ${columnName} already exists, skipping...`)
              continue
            }
          }
        }

        await connection.execute(statement)
        console.log(`✅ Statement ${i + 1} executed successfully`)
      } catch (error) {
        if (error.code === "ER_DUP_FIELDNAME") {
          console.log(`⚠️  Column already exists, skipping...`)
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message)
          throw error
        }
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("✅ Migration completed successfully!")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("\n📋 Added columns to trucks table:")
    console.log("   • product - Product/service type the truck usually carries")
    console.log("   • description - Description of the truck")
    console.log("   • type - Type of truck (e.g., flatbed, tanker, trailer, tipper)")
    console.log("   • color - Color of the truck")
    console.log("   • imageUrl - URL of the truck picture")
    console.log("   • notes - Additional notes about the truck")
    console.log("\n")

    process.exit(0)
  } catch (error) {
    console.error("\n❌ Migration error:", error.message)
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    process.exit(1)
  } finally {
    if (connection) {
      connection.release()
    }
  }
}

runMigration()

