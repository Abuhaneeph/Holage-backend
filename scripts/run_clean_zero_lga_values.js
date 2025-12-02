import pool from "../config/db.js"
import dotenv from "dotenv"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config()

const runCleanup = async () => {
  let connection
  try {
    console.log("🔄 Cleaning up '00' and '0' LGA values in shipments table...")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    connection = await pool.getConnection()

    const sqlFilePath = join(__dirname, "clean_zero_lga_values.sql")
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

    let totalAffected = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement || statement.length === 0) continue

      try {
        // Skip SELECT statements (they're just for reporting)
        if (statement.trim().toUpperCase().startsWith("SELECT")) {
          console.log(`📊 Running report query...`)
          const [rows] = await connection.execute(statement)
          if (rows && rows.length > 0) {
            const stats = rows[0]
            console.log(`\n📈 Cleanup Statistics:`)
            console.log(`   Total shipments: ${stats.total_shipments || 0}`)
            console.log(`   Shipments with NULL pickup LGA: ${stats.null_pickup_lga || 0}`)
            console.log(`   Shipments with NULL destination LGA: ${stats.null_destination_lga || 0}`)
          }
          continue
        }

        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`)
        const [result] = await connection.execute(statement)
        
        if (result.affectedRows !== undefined) {
          totalAffected += result.affectedRows
          console.log(`✅ Updated ${result.affectedRows} row(s)`)
        }
      } catch (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error.message)
        throw error
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log(`✅ Cleanup completed! Total rows affected: ${totalAffected}`)
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

  } catch (error) {
    console.error("❌ Error running cleanup:", error)
    process.exit(1)
  } finally {
    if (connection) {
      connection.release()
    }
    await pool.end()
    process.exit(0)
  }
}

runCleanup()

