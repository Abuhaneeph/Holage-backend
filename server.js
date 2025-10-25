import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url" // Import fileURLToPath for __dirname equivalent

import authRoutes from "./routes/auth.js"
import kycRoutes from "./routes/kyc.js"
import walletRoutes from "./routes/wallet.js"
import shippingRoutes from "./routes/shipping.js"
import pool from "./config/db.js" // Import to ensure connection is established
import http from "http"
import https from "https"

dotenv.config()

const app = express()

// __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Middleware
app.use(cors()) // Enable CORS for all origins (adjust in production)
app.use(express.json()) // Body parser for JSON requests
app.use("/uploads", express.static(path.join(__dirname, "uploads"))) // Serve static files from 'uploads' directory

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/kyc", kycRoutes)
app.use("/api/wallet", walletRoutes)
app.use("/api/shipping", shippingRoutes)

// Basic route for testing
app.get("/", (req, res) => {
  res.send("Holage App Backend API is running!")
})

// Test DB connection
pool
  .getConnection()
  .then((connection) => {
    console.log("Successfully connected to MySQL database!")
    connection.release()
  })
  .catch((err) => {
    console.error("Error connecting to MySQL database:", err.message)
  })

const PORT = process.env.PORT || 4000

// Get the app URL from environment variables or construct it
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;


// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  
  // Set up a ping mechanism to prevent sleep mode
  setInterval(() => {
    const client = APP_URL.startsWith('https:') ? https : http;
    client.get(APP_URL, (res) => {
      console.log(`🔄 Ping successful! Status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error('Ping failed:', err);
    });
  }, 14 * 60 * 1000);
});
