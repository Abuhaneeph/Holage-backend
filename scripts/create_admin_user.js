import bcrypt from "bcryptjs"
import pool from "../config/db.js"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config()

const createAdminUser = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@holage.com"
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123"
    const adminName = process.env.ADMIN_NAME || "Admin User"

    // Check if admin already exists
    const [existing] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [adminEmail]
    )

    if (existing.length > 0) {
      console.log("⚠️  Admin user already exists!")
      console.log(`Email: ${adminEmail}`)
      console.log("To reset password, update it in the database or delete and recreate the user.")
      return
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    // Create admin user
    const [result] = await pool.execute(
      `INSERT INTO users (fullName, email, password, role, isVerified, kycStatus)
       VALUES (?, ?, ?, 'admin', TRUE, 'approved')`,
      [adminName, adminEmail, hashedPassword]
    )

    console.log("\n✅ Admin user created successfully!")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("📧 Admin Login Details:")
    console.log(`   Email: ${adminEmail}`)
    console.log(`   Password: ${adminPassword}`)
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("⚠️  IMPORTANT: Change the password after first login!")
    console.log(`   Admin User ID: ${result.insertId}\n`)
  } catch (error) {
    console.error("❌ Error creating admin user:", error.message)
    process.exit(1)
  } finally {
    await pool.end()
    process.exit(0)
  }
}

createAdminUser()

