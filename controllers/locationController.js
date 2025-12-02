import {
  createLocationTracking,
  getCurrentLocation,
  getLocationHistory,
  getActiveLocationsByUserId,
  getLocationTrail
} from "../models/LocationTracking.js"
import { getShipmentById } from "../models/Shipment.js"
import { findUserById } from "../models/User.js"
import { getDriverById } from "../models/Driver.js"
import { getAcceptedBidByShipmentId } from "../models/Bid.js"

/**
 * Create location tracking entry
 */
export const trackLocation = async (req, res) => {
  try {
    const userId = req.user.id
    const { shipmentId } = req.body
    const { latitude, longitude, accuracy, speed, heading, address, batteryLevel } = req.body

    if (!shipmentId || !latitude || !longitude) {
      return res.status(400).json({
        message: "shipmentId, latitude, and longitude are required"
      })
    }

    // Validate shipment exists and user has access
    const shipment = await getShipmentById(shipmentId)
    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found" })
    }

    // Check if user has permission
    const user = await findUserById(userId)
    let hasAccess = false

    if (shipment.truckerId === userId) {
      hasAccess = true
    } else if (user.role === "driver") {
      const driver = await getDriverById(userId)
      if (driver && driver.fleetManagerId) {
        const acceptedBid = await getAcceptedBidByShipmentId(shipmentId)
        if (acceptedBid && acceptedBid.fleetManagerId === driver.fleetManagerId && acceptedBid.driverId === userId) {
          hasAccess = true
        }
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" })
    }

    const trackingId = await createLocationTracking({
      shipmentId,
      userId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: accuracy ? parseFloat(accuracy) : null,
      speed: speed ? parseFloat(speed) : null,
      heading: heading ? parseFloat(heading) : null,
      address,
      batteryLevel: batteryLevel ? parseInt(batteryLevel) : null
    })

    res.status(200).json({
      success: true,
      message: "Location tracked successfully",
      trackingId
    })
  } catch (error) {
    console.error("Error tracking location:", error)
    res.status(500).json({
      message: "Server error tracking location",
      error: error.message
    })
  }
}

/**
 * Get current location for a shipment
 */
export const getCurrentShipmentLocation = async (req, res) => {
  try {
    const { shipmentId } = req.params
    const userId = req.query.userId || null

    const location = await getCurrentLocation(shipmentId, userId)

    if (!location) {
      return res.status(404).json({
        message: "No active location found for this shipment"
      })
    }

    res.status(200).json({
      success: true,
      location
    })
  } catch (error) {
    console.error("Error fetching current location:", error)
    res.status(500).json({
      message: "Server error fetching location",
      error: error.message
    })
  }
}

/**
 * Get location history for a shipment
 */
export const getShipmentLocationHistory = async (req, res) => {
  try {
    const { shipmentId } = req.params
    const limit = parseInt(req.query.limit) || 100
    const offset = parseInt(req.query.offset) || 0

    const history = await getLocationHistory(shipmentId, limit, offset)

    res.status(200).json({
      success: true,
      history,
      count: history.length
    })
  } catch (error) {
    console.error("Error fetching location history:", error)
    res.status(500).json({
      message: "Server error fetching location history",
      error: error.message
    })
  }
}

/**
 * Get location trail (for route visualization)
 */
export const getShipmentLocationTrail = async (req, res) => {
  try {
    const { shipmentId } = req.params
    const { startTime, endTime } = req.query

    const trail = await getLocationTrail(shipmentId, startTime || null, endTime || null)

    res.status(200).json({
      success: true,
      trail,
      count: trail.length
    })
  } catch (error) {
    console.error("Error fetching location trail:", error)
    res.status(500).json({
      message: "Server error fetching location trail",
      error: error.message
    })
  }
}

/**
 * Get all active locations for current user
 */
export const getMyActiveLocations = async (req, res) => {
  try {
    const userId = req.user.id

    const locations = await getActiveLocationsByUserId(userId)

    res.status(200).json({
      success: true,
      locations,
      count: locations.length
    })
  } catch (error) {
    console.error("Error fetching active locations:", error)
    res.status(500).json({
      message: "Server error fetching active locations",
      error: error.message
    })
  }
}

