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
import { findUserById, getWalletBalance, createWalletTransaction } from "../models/User.js"
import axios from "axios"
import { calculateStateDistance, estimateShippingCost, slugify } from "../utils/distanceCalculator.js"

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
      pickupLga,
      destinationState,
      destinationLga,
      cargoType,
      weight,
      truckType,
      pickupDate,
      fragileItems,
      insurance
    } = req.body

    // Log received data for debugging
    console.log("Creating shipment with data:", {
      pickupState,
      pickupLga,
      destinationState,
      destinationLga,
      cargoType,
      weight,
      truckType,
      pickupDate,
      fragileItems
    })

    // Validate required fields
    if (!pickupState || !pickupLga || !destinationState || !destinationLga || !cargoType || !weight || !truckType || !pickupDate) {
      return res.status(400).json({ 
        message: "All fields are required: pickupState, pickupLga, destinationState, destinationLga, cargoType, weight, truckType, pickupDate" 
      })
    }

    // Validate that pickup and destination are different
    if (
      slugify(pickupState) === slugify(destinationState) &&
      slugify(pickupLga) === slugify(destinationLga)
    ) {
      return res.status(400).json({ 
        message: "Pickup and destination locations cannot be the same" 
      })
    }

    // Calculate distance and cost
    let distanceResult, costEstimate
    try {
      distanceResult = await calculateStateDistance(pickupState, destinationState, pickupLga, destinationLga)
      
      // Fetch diesel rate from database
      let dieselRate = 1200; // Default value
      try {
        const pool = (await import("../config/db.js")).default;
        const [rows] = await pool.execute(
          "SELECT setting_value FROM system_settings WHERE setting_key = 'diesel_rate_per_liter'"
        );
        if (rows.length > 0) {
          dieselRate = parseFloat(rows[0].setting_value) || 1200;
        }
      } catch (dbError) {
        console.error("Error fetching diesel rate from database, using default:", dbError);
      }
      
      // Validate distance result
      if (!distanceResult || !distanceResult.distance || distanceResult.distance === 0) {
        console.error("Invalid distance result:", distanceResult);
        throw new Error("Failed to calculate distance between locations");
      }
      
      costEstimate = estimateShippingCost(distanceResult.distance, parseFloat(weight), { 
        dieselRate,
        fragileItems: fragileItems || false,
        insurance: insurance || false
      })
      
      console.log("Cost calculation result:", {
        distance: distanceResult.distance,
        weight: parseFloat(weight),
        dieselRate,
        fragileItems: fragileItems || false,
        insurance: insurance || false,
        totalCost: costEstimate.totalCost
      });
    } catch (error) {
      console.error("Error calculating distance/cost:", error)
      console.error("Error stack:", error.stack)
      // Provide fallback values if calculation fails
      distanceResult = { distance: 0, estimatedDuration: "N/A" }
      costEstimate = { totalCost: 0 }
    }

    // Check wallet balance and deduct amount
    const walletBalance = await getWalletBalance(userId)
    const shipmentCost = costEstimate?.totalCost || 0
    
    if (shipmentCost <= 0) {
      return res.status(400).json({ message: "Invalid shipment cost. Please check your shipment details." })
    }

    if (walletBalance < shipmentCost) {
      return res.status(400).json({ 
        message: `Insufficient wallet balance. Required: ₦${shipmentCost.toLocaleString()}, Available: ₦${walletBalance.toLocaleString()}` 
      })
    }

    // Create shipment
    const shipmentId = await createShipment({
      shipperId: userId,
      pickupState,
      pickupLga,
      destinationState,
      destinationLga,
      cargoType,
      weight: parseFloat(weight),
      truckType,
      pickupDate,
      fragileItems: fragileItems || false,
      insurance: insurance || false,
      distance: distanceResult?.distance || 0,
      estimatedCost: costEstimate?.totalCost || 0,
      estimatedDuration: distanceResult?.estimatedDuration || "N/A"
    })

    // Deduct amount from shipper's wallet
    const timestamp = Date.now()
    const debitReference = `SHIPMENT-${timestamp}-${shipmentId}`
    await createWalletTransaction(userId, {
      reference: debitReference,
      amount: shipmentCost,
      currency: "NGN",
      type: "debit",
      status: "success",
      description: `Payment for shipment #${shipmentId}`,
      paystackReference: null,
      metadata: JSON.stringify({ shipmentId, costBreakdown: costEstimate })
    })

    // Get the created shipment
    const shipment = await getShipmentById(shipmentId)

    res.status(201).json({
      success: true,
      message: "Shipment created successfully",
      shipment,
      walletBalance: await getWalletBalance(userId)
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
 * Supports filtering by pickupState, destinationState, and truckType
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
    
    // Extract filters from query parameters
    const filters = {}
    if (req.query.pickupState) {
      filters.pickupState = req.query.pickupState
    }
    if (req.query.destinationState) {
      filters.destinationState = req.query.destinationState
    }
    if (req.query.truckType) {
      filters.truckType = req.query.truckType
    }

    const shipments = await getAvailableShipments(limit, offset, filters)

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

    // Check if trucker has bank account details
    if (!user.bankAccountNumber || !user.bankCode) {
      return res.status(400).json({ 
        message: "Bank account details required. Please update your profile with bank account information." 
      })
    }

    const success = await assignTruckerToShipment(shipmentId, userId)
    
    if (!success) {
      return res.status(400).json({ message: "Failed to assign shipment" })
    }

    // Transfer payment to trucker via Paystack
    const shipmentAmount = parseFloat(shipment.estimatedCost || 0)
    if (shipmentAmount > 0) {
      try {
        const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
        if (!PAYSTACK_SECRET_KEY) {
          console.error("Paystack secret key not configured")
        } else {
          // Create transfer recipient
          const recipientData = {
            type: "nuban",
            name: user.fullName || "Trucker",
            account_number: user.bankAccountNumber,
            bank_code: user.bankCode,
            currency: "NGN"
          }

          const recipientResponse = await axios.post(
            "https://api.paystack.co/transferrecipient",
            recipientData,
            {
              headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json"
              }
            }
          )

          if (recipientResponse.data.status && recipientResponse.data.data) {
            // Perform transfer
            const transferData = {
              source: "balance",
              amount: Math.round(shipmentAmount) * 100, // Convert to kobo
              recipient: recipientResponse.data.data.recipient_code,
              reason: `Payment for shipment #${shipmentId}`,
              currency: "NGN"
            }

            const transferResponse = await axios.post(
              "https://api.paystack.co/transfer",
              transferData,
              {
                headers: {
                  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                  "Content-Type": "application/json"
                }
              }
            )

            if (transferResponse.data.status) {
              // Record successful transfer
              const timestamp = Date.now()
              const creditReference = `PAYOUT-${timestamp}-${shipmentId}`
              await createWalletTransaction(userId, {
                reference: creditReference,
                amount: shipmentAmount,
                currency: "NGN",
                type: "credit",
                status: "success",
                description: `Payment received for shipment #${shipmentId}`,
                paystackReference: transferResponse.data.data.reference || creditReference,
                metadata: JSON.stringify({ 
                  shipmentId, 
                  transfer: transferResponse.data.data,
                  recipient: recipientResponse.data.data
                })
              })

              console.log(`✅ Payment transferred to trucker ${userId}: ₦${shipmentAmount} for shipment #${shipmentId}`)
            } else {
              console.error("Transfer failed:", transferResponse.data)
            }
          }
        }
      } catch (transferError) {
        console.error("Error transferring payment to trucker:", transferError.response?.data || transferError.message)
        // Don't fail the shipment acceptance if transfer fails - can be retried later
      }
    }

    const updatedShipment = await getShipmentById(shipmentId)

    res.status(200).json({
      success: true,
      message: "Shipment accepted successfully. Payment has been transferred to your bank account.",
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

