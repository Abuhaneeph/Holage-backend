import jwt from "jsonwebtoken"
import { findUserById } from "../models/User.js"
import { getDriverById } from "../models/Driver.js"
import dotenv from "dotenv"

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET

export const protect = async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1]
      const decoded = jwt.verify(token, JWT_SECRET)
      
      // Check if it's a driver token (has role: 'driver')
      if (decoded.role === 'driver') {
        const driver = await getDriverById(decoded.id)
        if (!driver) {
          return res.status(401).json({ message: "Not authorized, driver not found" })
        }
        // Create a user-like object for drivers
        req.user = {
          id: driver.id,
          role: 'driver',
          fleetManagerId: driver.fleetManagerId,
          driverName: driver.driverName,
          phoneNumber: driver.phoneNumber
        }
      } else {
        // Regular user token
        req.user = await findUserById(decoded.id)
        if (!req.user) {
          return res.status(401).json({ message: "Not authorized, user not found" })
        }
      }
      
      next()
    } catch (error) {
      console.error("Auth middleware error:", error)
      res.status(401).json({ message: "Not authorized, token failed" })
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" })
  }
}

// New middleware specifically for email-verified users
export const requireEmailVerification = (req, res, next) => {
  if (!req.user.isVerified) { // Changed from emailVerified to isVerified
    return res.status(403).json({
      message: "Email verification required before accessing this feature"
    })
  }
  next()
}

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `User role ${req.user.role} is not authorized to access this route` })
    }
    next()
  }
}

// Alias for protect (for backward compatibility)
export const authenticate = protect
