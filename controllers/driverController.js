import {
  createDriver,
  getDriverById,
  getDriversByFleetManagerId,
  updateDriver,
  deleteDriver,
  checkPhoneNumberExists,
  verifyDriverPassword
} from "../models/Driver.js"
import { findUserById } from "../models/User.js"
import jwt from "jsonwebtoken"

/**
 * Register a new driver (Fleet Manager only)
 */
export const registerDriver = async (req, res) => {
  const userId = req.user.id
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "fleet_manager") {
      return res.status(403).json({ message: "Only fleet managers can register drivers" })
    }

    const { driverName, phoneNumber, driverLicense, password } = req.body

    if (!driverName || !phoneNumber || !driverLicense || !password) {
      return res.status(400).json({ 
        message: "driverName, phoneNumber, driverLicense, and password are required" 
      })
    }

    // Check if phone number already exists
    const phoneExists = await checkPhoneNumberExists(phoneNumber)
    if (phoneExists) {
      return res.status(409).json({ 
        message: "Driver with this phone number already exists" 
      })
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ 
        message: "Password must be at least 6 characters long" 
      })
    }

    const driverId = await createDriver({
      fleetManagerId: userId,
      driverName,
      phoneNumber,
      driverLicense,
      password
    })

    const driver = await getDriverById(driverId)

    res.status(201).json({
      success: true,
      message: "Driver registered successfully",
      driver: {
        id: driver.id,
        driverName: driver.driverName,
        phoneNumber: driver.phoneNumber,
        driverLicense: driver.driverLicense,
        isActive: driver.isActive
      }
    })

  } catch (error) {
    console.error("Error registering driver:", error)
    res.status(500).json({ 
      message: "Server error registering driver", 
      error: error.message 
    })
  }
}

/**
 * Get all drivers for the logged-in fleet manager
 */
export const getMyDrivers = async (req, res) => {
  const userId = req.user.id
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "fleet_manager") {
      return res.status(403).json({ message: "Only fleet managers can access this endpoint" })
    }

    const drivers = await getDriversByFleetManagerId(userId)

    res.status(200).json({
      success: true,
      drivers
    })

  } catch (error) {
    console.error("Error fetching drivers:", error)
    res.status(500).json({ 
      message: "Server error fetching drivers", 
      error: error.message 
    })
  }
}

/**
 * Get a single driver by ID
 */
export const getDriver = async (req, res) => {
  const userId = req.user.id
  const { driverId } = req.params
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const driver = await getDriverById(driverId)
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" })
    }

    // Only fleet manager who owns the driver can view
    if (user.role !== "fleet_manager" || driver.fleetManagerId !== userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    res.status(200).json({
      success: true,
      driver
    })

  } catch (error) {
    console.error("Error fetching driver:", error)
    res.status(500).json({ 
      message: "Server error fetching driver", 
      error: error.message 
    })
  }
}

/**
 * Update a driver
 */
export const updateDriverById = async (req, res) => {
  const userId = req.user.id
  const { driverId } = req.params
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "fleet_manager") {
      return res.status(403).json({ message: "Only fleet managers can update drivers" })
    }

    const driver = await getDriverById(driverId)
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" })
    }

    if (driver.fleetManagerId !== userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    const { driverName, phoneNumber, driverLicense, password, isActive } = req.body

    // Check if phone number is being changed and if it already exists
    if (phoneNumber && phoneNumber !== driver.phoneNumber) {
      const phoneExists = await checkPhoneNumberExists(phoneNumber, driverId)
      if (phoneExists) {
        return res.status(409).json({ 
          message: "Driver with this phone number already exists" 
        })
      }
    }

    // Validate password if provided
    if (password && password.length < 6) {
      return res.status(400).json({ 
        message: "Password must be at least 6 characters long" 
      })
    }

    const success = await updateDriver(driverId, userId, {
      driverName: driverName || driver.driverName,
      phoneNumber: phoneNumber || driver.phoneNumber,
      driverLicense: driverLicense || driver.driverLicense,
      password: password || null,
      isActive: isActive !== undefined ? isActive : driver.isActive
    })

    if (!success) {
      return res.status(400).json({ message: "Failed to update driver" })
    }

    const updatedDriver = await getDriverById(driverId)

    res.status(200).json({
      success: true,
      message: "Driver updated successfully",
      driver: updatedDriver
    })

  } catch (error) {
    console.error("Error updating driver:", error)
    res.status(500).json({ 
      message: "Server error updating driver", 
      error: error.message 
    })
  }
}

/**
 * Delete a driver
 */
export const deleteDriverById = async (req, res) => {
  const userId = req.user.id
  const { driverId } = req.params
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "fleet_manager") {
      return res.status(403).json({ message: "Only fleet managers can delete drivers" })
    }

    const driver = await getDriverById(driverId)
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" })
    }

    if (driver.fleetManagerId !== userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    const success = await deleteDriver(driverId, userId)
    
    if (!success) {
      return res.status(400).json({ message: "Failed to delete driver" })
    }

    res.status(200).json({
      success: true,
      message: "Driver deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting driver:", error)
    res.status(500).json({ 
      message: "Server error deleting driver", 
      error: error.message 
    })
  }
}

/**
 * Driver login
 */
export const driverLogin = async (req, res) => {
  const { phoneNumber, password } = req.body

  if (!phoneNumber || !password) {
    return res.status(400).json({ message: "Phone number and password are required" })
  }

  try {
    // Normalize phone number - remove spaces, dashes, plus signs
    let normalizedPhone = phoneNumber.replace(/\s/g, '').replace(/-/g, '').replace(/\+/g, '')
    
    console.log(`🔍 Attempting driver login with phone: ${phoneNumber} (normalized: ${normalizedPhone})`)
    
    // Try with the phone number as-is first (e.g., 08117458593)
    let driver = await verifyDriverPassword(normalizedPhone, password)
    
    // If not found and starts with 0, try without leading 0 (e.g., 8117458593)
    if (!driver && normalizedPhone.startsWith('0') && normalizedPhone.length === 11) {
      console.log(`🔍 Trying without leading 0: ${normalizedPhone.substring(1)}`)
      driver = await verifyDriverPassword(normalizedPhone.substring(1), password)
    }
    
    // If still not found and doesn't start with 0, try with 0 prefix (e.g., 08117458593)
    if (!driver && !normalizedPhone.startsWith('0') && normalizedPhone.length === 10) {
      console.log(`🔍 Trying with leading 0: 0${normalizedPhone}`)
      driver = await verifyDriverPassword('0' + normalizedPhone, password)
    }
    
    if (!driver) {
      console.error(`❌ Driver login failed for phone: ${phoneNumber} (normalized: ${normalizedPhone})`)
      return res.status(401).json({ message: "Invalid phone number or password. Please check your credentials or contact your fleet manager." })
    }
    
    console.log(`✅ Driver found: ${driver.driverName} (ID: ${driver.id})`)

    if (!driver.isActive) {
      return res.status(403).json({ message: "Driver account is inactive. Please contact your fleet manager." })
    }

    const JWT_SECRET = process.env.JWT_SECRET
    const token = jwt.sign(
      { 
        id: driver.id, 
        role: 'driver',
        fleetManagerId: driver.fleetManagerId 
      }, 
      JWT_SECRET, 
      { expiresIn: "30d" }
    )

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      driver: {
        id: driver.id,
        driverName: driver.driverName,
        phoneNumber: driver.phoneNumber,
        fleetManagerId: driver.fleetManagerId,
        fleetManagerName: driver.fleetManagerName
      }
    })
  } catch (error) {
    console.error("Driver login error:", error)
    res.status(500).json({ message: "Server error during login" })
  }
}

