import pool from "../config/db.js"
import dotenv from "dotenv"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config()

const runMigration = async () => {
  let connection
  try {
    console.log("🔄 Running shipment confirmations migration...")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    // Get a connection from the pool
    connection = await pool.getConnection()

    // Read the SQL file
    const sqlFilePath = join(__dirname, "add_shipment_confirmations.sql")
    const sql = readFileSync(sqlFilePath, "utf8")

    // Remove comments and split by semicolon, but keep multi-line statements together
    const cleanedSql = sql
      .split("\n")
      .filter(line => !line.trim().startsWith("--") || line.trim() === "")
      .join("\n")

    // Split by semicolon, but be careful with multi-line statements
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
        
        // Handle CREATE INDEX which might fail if index already exists
        if (statement.toUpperCase().includes("CREATE INDEX")) {
          try {
            await connection.execute(statement)
            console.log(`✅ Index created successfully`)
          } catch (error) {
            if (error.code === "ER_DUP_KEYNAME" || error.code === "ER_DUP_KEY") {
              console.log(`⚠️  Index already exists, skipping...`)
            } else if (error.code === "ER_KEY_COLUMN_DOES_NOT_EXITS") {
              console.log(`⚠️  Column for index doesn't exist yet, will retry after ALTER TABLE...`)
              // Store this for later execution
              statements.push(statement)
              continue
            } else {
              throw error
            }
          }
        } 
        // Handle ALTER TABLE
        else if (statement.toUpperCase().includes("ALTER TABLE")) {
          // Check if columns already exist
          const columnMatches = statement.match(/ADD COLUMN (\w+)/gi)
          if (columnMatches && columnMatches.length > 0) {
            const columns = columnMatches.map(m => m.replace(/ADD COLUMN /i, "").trim())
            
            // Check if any columns already exist
            const [existingColumns] = await connection.execute(
              `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'shipments' 
               AND COLUMN_NAME IN (${columns.map(() => "?").join(",")})`,
              [process.env.DB_DATABASE || "holage_db", ...columns]
            )

            if (existingColumns.length > 0) {
              const existingColNames = existingColumns.map(c => c.COLUMN_NAME)
              console.log(`⚠️  Some columns already exist: ${existingColNames.join(", ")}`)
              
              // If all columns exist, skip
              if (existingColNames.length === columns.length) {
                console.log(`   All columns already exist, skipping ALTER TABLE...`)
                continue
              }
              
              // If some columns exist, we need to modify the statement
              // For simplicity, we'll try to execute and handle the error
            }
          }

          try {
            await connection.execute(statement)
            console.log(`✅ ALTER TABLE executed successfully`)
          } catch (error) {
            if (error.code === "ER_DUP_FIELDNAME") {
              console.log(`⚠️  Column already exists, skipping...`)
            } else {
              throw error
            }
          }
        } 
        // Handle other statements
        else {
          await connection.execute(statement)
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }
      } catch (error) {
        // Handle specific MySQL errors
        if (error.code === "ER_DUP_FIELDNAME") {
          console.log(`⚠️  Column already exists, skipping...`)
        } else if (error.code === "ER_DUP_KEYNAME" || error.code === "ER_DUP_KEY") {
          console.log(`⚠️  Index already exists, skipping...`)
        } else if (error.code === "ER_KEY_COLUMN_DOES_NOT_EXITS") {
          console.log(`⚠️  Column for index doesn't exist yet. Make sure ALTER TABLE runs first.`)
          throw error
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message)
          console.error(`   SQL: ${statement.substring(0, 100)}...`)
          throw error
        }
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("✅ Migration completed successfully!")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("\n📋 Added fields to shipments table:")
    console.log("   • pickupConfirmed (TINYINT)")
    console.log("   • deliveryConfirmed (TINYINT)")
    console.log("   • pickupConfirmedAt (DATETIME)")
    console.log("   • deliveryConfirmedAt (DATETIME)")
    console.log("\n📋 Added indexes:")
    console.log("   • idx_pickup_confirmed")
    console.log("   • idx_delivery_confirmed\n")

  } catch (error) {
    console.error("\n❌ Migration failed:", error.message)
    console.error("Error details:", error)
    process.exit(1)
  } finally {
    if (connection) {
      connection.release()
    }
    // Close the pool
    await pool.end()
    process.exit(0)
  }
}

// Run the migration
runMigration()

