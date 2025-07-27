import mysql from "mysql2/promise"
import dotenv from "dotenv"

dotenv.config()

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "holage_db",
  port: process.env.DB_PORT || 3306,
  ssl: {
    rejectUnauthorized: false, // For development - in production, use proper SSL certificates
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export default pool