import pool from "../config/db.js"
import dotenv from "dotenv"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config()

const runMigrations = async () => {
  let connection
  try {
    console.log("🔄 Running all new features migrations...")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    connection = await pool.getConnection()

    const migrations = [
      { file: "create_notifications_table.sql", name: "Notifications Table" },
      { file: "create_pod_table.sql", name: "POD Documents Table" },
      { file: "create_location_tracking_table.sql", name: "Location Tracking Table" }
    ]

    for (const migration of migrations) {
      console.log(`📝 Running: ${migration.name}`)
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

      const sqlFilePath = join(__dirname, migration.file)
      const sql = readFileSync(sqlFilePath, "utf8")

      // Remove comments and split by semicolon
      const cleanedSql = sql
        .split("\n")
        .filter(line => !line.trim().startsWith("--") || line.trim() === "")
        .join("\n")

      const statements = cleanedSql
        .split(";")
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0)

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        if (!statement || statement.length === 0) continue

        try {
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`)
          
          // Check if table already exists
          if (statement.toUpperCase().includes("CREATE TABLE")) {
            const tableMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)
            if (tableMatch) {
              const tableName = tableMatch[1]
              const [existing] = await connection.execute(
                `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
                [process.env.DB_DATABASE || "holage_db", tableName]
              )

              if (existing.length > 0) {
                console.log(`⚠️  Table ${tableName} already exists, skipping...`)
                continue
              }
            }
          }

          await connection.execute(statement)
          console.log(`✅ Statement ${i + 1} executed successfully`)
        } catch (error) {
          if (error.code === "ER_TABLE_EXISTS_ERROR" || error.code === "ER_DUP_TABLE") {
            console.log(`⚠️  Table already exists, skipping...`)
          } else {
            console.error(`❌ Error:`, error.message)
            throw error
          }
        }
      }

      console.log(`✅ ${migration.name} completed!\n`)
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("✅ All migrations completed successfully!")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("\n📋 Created tables:")
    console.log("   • notifications - For push and in-app notifications")
    console.log("   • pod_documents - For proof of delivery (photos & signatures)")
    console.log("   • location_tracking - For GPS tracking\n")

  } catch (error) {
    console.error("\n❌ Migration failed:", error.message)
    console.error("Error details:", error)
    process.exit(1)
  } finally {
    if (connection) {
      connection.release()
    }
    await pool.end()
    process.exit(0)
  }
}

runMigrations()

