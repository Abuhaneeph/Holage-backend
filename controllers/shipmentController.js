import {
  createShipment,
  getShipmentById,
  getShipmentsByShipperId,
  getShipmentsByTruckerId,
  getAvailableShipments,
  assignTruckerToShipment,
  updateShipmentStatus,
  deleteShipment
} from "../models/Shipment.js"
import { findUserById } from "../models/User.js"
import { calculateStateDistance, estimateShippingCost } from "../utils/distanceCalculator.js"

/**
 * Create a new shipment
 */
export const createNewShipment = async (req, res) => {
  const userId = req.user.id
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Only shippers can create shipments
    if (user.role !== "shipper") {
      return res.status(403).json({ message: "Only shippers can create shipments" })
    }

    const {
      pickupState,
      destinationState,
      cargoType,
      weight,
      truckType,
      pickupDate,
      fragileItems
    } = req.body

    // Log received data for debugging
    console.log("Creating shipment with data:", {
      pickupState,
      destinationState,
      cargoType,
      weight,
      truckType,
      pickupDate,
      fragileItems
    })

    // Validate required fields
    if (!pickupState || !destinationState || !cargoType || !weight || !truckType || !pickupDate) {
      return res.status(400).json({ 
        message: "All fields are required: pickupState, destinationState, cargoType, weight, truckType, pickupDate" 
      })
    }

    // Validate that pickup and destination are different
    if (pickupState === destinationState) {
      return res.status(400).json({ 
        message: "Pickup and destination states cannot be the same" 
      })
    }

    // Calculate distance and cost
    let distanceResult, costEstimate
    try {
      distanceResult = calculateStateDistance(pickupState, destinationState)
      costEstimate = estimateShippingCost(distanceResult.distance, parseFloat(weight))
    } catch (error) {
      console.error("Error calculating distance/cost:", error)
      // Provide fallback values if calculation fails
      distanceResult = { distance: 0, estimatedDuration: "N/A" }
      costEstimate = { estimatedCost: 0 }
    }

    // Create shipment
    const shipmentId = await createShipment({
      shipperId: userId,
      pickupState,
      destinationState,
      cargoType,
      weight: parseFloat(weight),
      truckType,
      pickupDate,
      fragileItems: fragileItems || false,
      distance: distanceResult?.distance || 0,
      estimatedCost: costEstimate?.estimatedCost || 0,
      estimatedDuration: distanceResult?.estimatedDuration || "N/A"
    })

    // Get the created shipment
    const shipment = await getShipmentById(shipmentId)

    res.status(201).json({
      success: true,
      message: "Shipment created successfully",
      shipment
    })

  } catch (error) {
    console.error("Error creating shipment:", error)
    res.status(500).json({ 
      message: "Server error creating shipment", 
      error: error.message 
    })
  }
}

/**
 * Get all shipments for the logged-in shipper
 */
export const getMyShipments = async (req, res) => {
  const userId = req.user.id
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "shipper") {
      return res.status(403).json({ message: "Only shippers can access this endpoint" })
    }

    const limit = parseInt(req.query.limit) || 20
    const offset = parseInt(req.query.offset) || 0

    const shipments = await getShipmentsByShipperId(userId, limit, offset)

    res.status(200).json({
      success: true,
      shipments
    })

  } catch (error) {
    console.error("Error fetching shipments:", error)
    res.status(500).json({ 
      message: "Server error fetching shipments", 
      error: error.message 
    })
  }
}

/**
 * Get available shipments for truckers to bid on
 */
export const getAvailableShipmentsForTruckers = async (req, res) => {
  const userId = req.user.id
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "trucker") {
      return res.status(403).json({ message: "Only truckers can access this endpoint" })
    }

    const limit = parseInt(req.query.limit) || 20
    const offset = parseInt(req.query.offset) || 0

    const shipments = await getAvailableShipments(limit, offset)

    res.status(200).json({
      success: true,
      shipments
    })

  } catch (error) {
    console.error("Error fetching available shipments:", error)
    res.status(500).json({ 
      message: "Server error fetching shipments", 
      error: error.message 
    })
  }
}

/**
 * Get all shipments assigned to the logged-in trucker
 */
export const getMyAssignedShipments = async (req, res) => {
  const userId = req.user.id
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "trucker") {
      return res.status(403).json({ message: "Only truckers can access this endpoint" })
    }

    const limit = parseInt(req.query.limit) || 20
    const offset = parseInt(req.query.offset) || 0

    const shipments = await getShipmentsByTruckerId(userId, limit, offset)

    res.status(200).json({
      success: true,
      shipments
    })

  } catch (error) {
    console.error("Error fetching assigned shipments:", error)
    res.status(500).json({ 
      message: "Server error fetching shipments", 
      error: error.message 
    })
  }
}

/**
 * Get a single shipment by ID
 */
export const getShipmentDetails = async (req, res) => {
  const userId = req.user.id
  const { shipmentId } = req.params
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const shipment = await getShipmentById(shipmentId)
    
    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found" })
    }

    // Check if user has access to this shipment
    if (user.role === "shipper" && shipment.shipperId !== userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    if (user.role === "trucker" && shipment.truckerId !== userId && shipment.status !== "pending") {
      return res.status(403).json({ message: "Access denied" })
    }

    res.status(200).json({
      success: true,
      shipment
    })

  } catch (error) {
    console.error("Error fetching shipment details:", error)
    res.status(500).json({ 
      message: "Server error fetching shipment", 
      error: error.message 
    })
  }
}

/**
 * Assign a trucker to a shipment (trucker accepts a job)
 */
export const acceptShipment = async (req, res) => {
  const userId = req.user.id
  const { shipmentId } = req.params
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "trucker") {
      return res.status(403).json({ message: "Only truckers can accept shipments" })
    }

    const shipment = await getShipmentById(shipmentId)
    
    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found" })
    }

    if (shipment.status !== "pending") {
      return res.status(400).json({ message: "Shipment is no longer available" })
    }

    if (shipment.truckerId) {
      return res.status(400).json({ message: "Shipment already assigned to another trucker" })
    }

    const success = await assignTruckerToShipment(shipmentId, userId)
    
    if (!success) {
      return res.status(400).json({ message: "Failed to assign shipment" })
    }

    const updatedShipment = await getShipmentById(shipmentId)

    res.status(200).json({
      success: true,
      message: "Shipment accepted successfully",
      shipment: updatedShipment
    })

  } catch (error) {
    console.error("Error accepting shipment:", error)
    res.status(500).json({ 
      message: "Server error accepting shipment", 
      error: error.message 
    })
  }
}

/**
 * Update shipment status
 */
export const updateShipment = async (req, res) => {
  const userId = req.user.id
  const { shipmentId } = req.params
  const { status } = req.body
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const shipment = await getShipmentById(shipmentId)
    
    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found" })
    }

    // Only shipper or assigned trucker can update status
    if (shipment.shipperId !== userId && shipment.truckerId !== userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Validate status
    const validStatuses = ['pending', 'assigned', 'in_transit', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const success = await updateShipmentStatus(shipmentId, status)
    
    if (!success) {
      return res.status(400).json({ message: "Failed to update shipment status" })
    }

    const updatedShipment = await getShipmentById(shipmentId)

    res.status(200).json({
      success: true,
      message: "Shipment status updated successfully",
      shipment: updatedShipment
    })

  } catch (error) {
    console.error("Error updating shipment:", error)
    res.status(500).json({ 
      message: "Server error updating shipment", 
      error: error.message 
    })
  }
}

/**
 * Delete a shipment (only if status is 'pending')
 */
export const deleteShipmentById = async (req, res) => {
  const userId = req.user.id
  const { shipmentId } = req.params
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "shipper") {
      return res.status(403).json({ message: "Only shippers can delete shipments" })
    }

    const success = await deleteShipment(shipmentId, userId)
    
    if (!success) {
      return res.status(400).json({ 
        message: "Failed to delete shipment. It may not exist, belong to you, or is no longer pending." 
      })
    }

    res.status(200).json({
      success: true,
      message: "Shipment deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting shipment:", error)
    res.status(500).json({ 
      message: "Server error deleting shipment", 
      error: error.message 
    })
  }
}

