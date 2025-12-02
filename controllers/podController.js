import {
  createOrUpdatePOD,
  getPODByShipmentAndType,
  getPODsByShipmentId,
  getPODsByUserId,
  deletePOD
} from "../models/POD.js"
import { getShipmentById } from "../models/Shipment.js"
import { findUserById } from "../models/User.js"
import { getDriverById } from "../models/Driver.js"
import { getAcceptedBidByShipmentId } from "../models/Bid.js"
import multer from "multer"
import path from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/pod")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, `pod-${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error("Only image files are allowed (jpeg, jpg, png, webp)"))
    }
  }
})

/**
 * Create or update POD document
 */
export const createPOD = async (req, res) => {
  try {
    const userId = req.user.id
    const { shipmentId } = req.params
    const { podType, signatureData, signatureName, signaturePhone, notes, latitude, longitude, address } = req.body

    // Validate podType
    if (!podType || !['pickup', 'delivery'].includes(podType)) {
      return res.status(400).json({
        message: "podType must be 'pickup' or 'delivery'"
      })
    }

    // Check shipment exists and user has access
    const shipment = await getShipmentById(shipmentId)
    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found" })
    }

    // Check if user has permission (driver, trucker, or fleet manager assigned to this shipment)
    // For drivers, use req.user directly (set by auth middleware)
    // For other users, fetch from database
    let user
    if (req.user.role === 'driver') {
      user = req.user
    } else {
      user = await findUserById(userId)
      if (!user) {
        return res.status(404).json({ message: "User not found" })
      }
    }
    
    let hasAccess = false

    if (shipment.truckerId === userId) {
      hasAccess = true
    } else if (user.role === "driver") {
      // For drivers, check if shipment is assigned to their fleet manager
      // req.user.fleetManagerId is already set by auth middleware
      if (req.user.fleetManagerId) {
        const acceptedBid = await getAcceptedBidByShipmentId(shipmentId)
        if (acceptedBid && acceptedBid.fleetManagerId === req.user.fleetManagerId && acceptedBid.driverId === userId) {
          hasAccess = true
        }
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied. You can only create POD for assigned shipments." })
    }

    // Handle file uploads
    const photos = []
    if (req.files && req.files.length > 0) {
      photos.push(...req.files.map(file => `/uploads/pod/${file.filename}`))
    }

    // If photos are provided in body (for base64 or URLs), add them
    if (req.body.photos && Array.isArray(req.body.photos)) {
      photos.push(...req.body.photos)
    }

    // For drivers, use fleet manager's ID instead (since drivers aren't in users table)
    // For other users, use their own ID
    const podUserId = req.user.role === 'driver' ? req.user.fleetManagerId : userId

    const podId = await createOrUpdatePOD({
      shipmentId,
      userId: podUserId,
      podType,
      photos: photos.length > 0 ? photos : null,
      signatureData,
      signatureName,
      signaturePhone,
      notes,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      address
    })

    res.status(200).json({
      success: true,
      message: `POD ${podType} created/updated successfully`,
      podId
    })
  } catch (error) {
    console.error("Error creating POD:", error)
    res.status(500).json({
      message: "Server error creating POD",
      error: error.message
    })
  }
}

// Middleware for handling file uploads
export const uploadPODPhotos = upload.array('photos', 10) // Max 10 photos

/**
 * Get POD by shipment and type
 */
export const getPOD = async (req, res) => {
  try {
    const { shipmentId, podType } = req.params

    const pod = await getPODByShipmentAndType(shipmentId, podType)

    if (!pod) {
      return res.status(404).json({
        message: "POD not found"
      })
    }

    res.status(200).json({
      success: true,
      pod
    })
  } catch (error) {
    console.error("Error fetching POD:", error)
    res.status(500).json({
      message: "Server error fetching POD",
      error: error.message
    })
  }
}

/**
 * Get all PODs for a shipment
 */
export const getShipmentPODs = async (req, res) => {
  try {
    const { shipmentId } = req.params

    const pods = await getPODsByShipmentId(shipmentId)

    res.status(200).json({
      success: true,
      pods
    })
  } catch (error) {
    console.error("Error fetching PODs:", error)
    res.status(500).json({
      message: "Server error fetching PODs",
      error: error.message
    })
  }
}

/**
 * Get PODs by current user
 */
export const getMyPODs = async (req, res) => {
  try {
    const userId = req.user.id
    const limit = parseInt(req.query.limit) || 50
    const offset = parseInt(req.query.offset) || 0

    // For drivers, use fleet manager's ID (since PODs are stored with fleet manager ID)
    // For other users, use their own ID
    const podUserId = req.user.role === 'driver' ? req.user.fleetManagerId : userId

    const pods = await getPODsByUserId(podUserId, limit, offset)

    res.status(200).json({
      success: true,
      pods
    })
  } catch (error) {
    console.error("Error fetching PODs:", error)
    res.status(500).json({
      message: "Server error fetching PODs",
      error: error.message
    })
  }
}

/**
 * Delete POD
 */
export const deletePODDocument = async (req, res) => {
  try {
    const userId = req.user.id
    const { podId } = req.params

    // For drivers, use fleet manager's ID (since PODs are stored with fleet manager ID)
    // For other users, use their own ID
    const podUserId = req.user.role === 'driver' ? req.user.fleetManagerId : userId

    const success = await deletePOD(podId, podUserId)

    if (!success) {
      return res.status(404).json({
        message: "POD not found or access denied"
      })
    }

    res.status(200).json({
      success: true,
      message: "POD deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting POD:", error)
    res.status(500).json({
      message: "Server error deleting POD",
      error: error.message
    })
  }
}

