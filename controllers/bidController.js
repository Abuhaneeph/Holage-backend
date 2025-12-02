import {
  createBid,
  getBidById,
  getBidsByShipmentId,
  getBidsByTruckerId,
  getBidsByDriverId,
  getBidsByFleetManagerId,
  checkExistingBid,
  checkExistingFleetManagerBid,
  acceptBid,
  updateBidStatus,
  deleteBid,
  getAcceptedBidByShipmentId
} from "../models/Bid.js"
import { getShipmentById, assignTruckerToShipment } from "../models/Shipment.js"
import { findUserById, createWalletTransaction, getWalletBalance } from "../models/User.js"
import { getDriverById } from "../models/Driver.js"
import { notifyBidAccepted, notifyNewBid } from "../utils/notificationService.js"
import axios from "axios"

/**
 * Submit a bid for a shipment
 */
export const submitBid = async (req, res) => {
  const userId = req.user.id
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Allow both truckers and fleet managers to submit bids
    if (user.role !== "trucker" && user.role !== "fleet_manager") {
      return res.status(403).json({ message: "Only truckers and fleet managers can submit bids" })
    }

    const { shipmentId, bidAmount, message, driverId } = req.body

    if (!shipmentId || !bidAmount) {
      return res.status(400).json({ 
        message: "shipmentId and bidAmount are required" 
      })
    }

    // Get shipment details
    const shipment = await getShipmentById(shipmentId)
    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found" })
    }

    if (shipment.status !== "pending") {
      return res.status(400).json({ 
        message: "Shipment is no longer available for bidding" 
      })
    }

    if (shipment.truckerId) {
      return res.status(400).json({ 
        message: "Shipment has already been assigned" 
      })
    }

    // Check if user has already bid
    if (user.role === "fleet_manager") {
      // Fleet manager bidding on behalf of a driver
      if (!driverId) {
        return res.status(400).json({ 
          message: "driverId is required when bidding as a fleet manager" 
        })
      }

      // Verify driver belongs to this fleet manager
      const driver = await getDriverById(driverId)
      if (!driver || driver.fleetManagerId !== userId) {
        return res.status(403).json({ 
          message: "Driver not found or does not belong to you" 
        })
      }

      // Check if fleet manager has already bid for this driver on this shipment
      const existingBid = await checkExistingFleetManagerBid(shipmentId, userId, driverId)
      if (existingBid) {
        return res.status(400).json({ 
          message: "You have already submitted a bid for this driver on this shipment." 
        })
      }
    } else {
      // Regular trucker bid
      const existingBid = await checkExistingBid(shipmentId, userId)
      if (existingBid) {
        return res.status(400).json({ 
          message: "You have already submitted a bid for this shipment. You can update or delete your existing bid." 
        })
      }
    }

    const estimatedCost = parseFloat(shipment.estimatedCost || 0)
    const bidAmountNum = parseFloat(bidAmount)

    if (isNaN(bidAmountNum) || bidAmountNum <= 0) {
      return res.status(400).json({ 
        message: "Bid amount must be a positive number" 
      })
    }

    // Validate bid amount: should not exceed estimatedCost + 200,000
    const maxBidAmount = estimatedCost + 200000
    if (bidAmountNum > maxBidAmount) {
      return res.status(400).json({ 
        message: `Bid amount cannot exceed ₦${maxBidAmount.toLocaleString()}. Maximum allowed: ₦${estimatedCost.toLocaleString()} (base) + ₦200,000 (maximum addition) = ₦${maxBidAmount.toLocaleString()}` 
      })
    }

    // Validate bid amount: should be at least the estimated cost
    if (bidAmountNum < estimatedCost) {
      return res.status(400).json({ 
        message: `Bid amount cannot be less than the estimated cost of ₦${estimatedCost.toLocaleString()}` 
      })
    }

    // Create the bid
    const bidId = await createBid({
      shipmentId,
      truckerId: user.role === "trucker" ? userId : null,
      bidAmount: bidAmountNum,
      message: message || null,
      driverId: user.role === "fleet_manager" ? driverId : null,
      fleetManagerId: user.role === "fleet_manager" ? userId : null
    })

    const bid = await getBidById(bidId)

    // Send notification to shipper about new bid
    try {
      await notifyNewBid(shipment.shipperId, bid, shipment)
    } catch (notifError) {
      console.error("Error sending new bid notification:", notifError)
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      message: "Bid submitted successfully",
      bid
    })

  } catch (error) {
    console.error("Error submitting bid:", error)
    res.status(500).json({ 
      message: "Server error submitting bid", 
      error: error.message 
    })
  }
}

/**
 * Get all bids for a shipment (for shippers)
 */
export const getShipmentBids = async (req, res) => {
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

    // Only shipper who owns the shipment can view bids
    if (user.role !== "shipper" || shipment.shipperId !== userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    const bids = await getBidsByShipmentId(shipmentId)

    res.status(200).json({
      success: true,
      bids,
      shipment
    })

  } catch (error) {
    console.error("Error fetching shipment bids:", error)
    res.status(500).json({ 
      message: "Server error fetching bids", 
      error: error.message 
    })
  }
}

/**
 * Get all bids by the logged-in trucker, driver, or fleet manager
 */
export const getMyBids = async (req, res) => {
  const userId = req.user.id
  const userRole = req.user.role
  
  try {
    let bids = []
    
    if (userRole === "driver") {
      // For drivers, get bids by driver ID (drivers are not in users table)
      bids = await getBidsByDriverId(userId)
    } else {
      // For truckers and fleet managers, verify they exist in users table
      const user = await findUserById(userId)
      if (!user) {
        return res.status(404).json({ message: "User not found" })
      }

      if (userRole === "trucker") {
        bids = await getBidsByTruckerId(userId)
      } else if (userRole === "fleet_manager") {
        // For fleet managers, get bids by fleet manager ID
        bids = await getBidsByFleetManagerId(userId)
      } else {
        return res.status(403).json({ message: "Only truckers, drivers, and fleet managers can access this endpoint" })
      }
    }

    res.status(200).json({
      success: true,
      bids
    })

  } catch (error) {
    console.error("Error fetching bids:", error)
    res.status(500).json({ 
      message: "Server error fetching bids", 
      error: error.message 
    })
  }
}

/**
 * Accept a bid (shipper accepts a trucker's bid)
 */
export const acceptBidForShipment = async (req, res) => {
  const userId = req.user.id
  const { bidId } = req.params
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "shipper") {
      return res.status(403).json({ message: "Only shippers can accept bids" })
    }

    // Get bid details
    const bid = await getBidById(bidId)
    if (!bid) {
      return res.status(404).json({ message: "Bid not found" })
    }

    // Get shipment details
    const shipment = await getShipmentById(bid.shipmentId)
    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found" })
    }

    // Verify shipper owns the shipment
    if (shipment.shipperId !== userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    if (shipment.status !== "pending") {
      return res.status(400).json({ 
        message: "Shipment is no longer available" 
      })
    }

    if (shipment.truckerId) {
      return res.status(400).json({ 
        message: "Shipment has already been assigned" 
      })
    }

    if (bid.status !== "pending") {
      return res.status(400).json({ 
        message: "Bid is no longer available" 
      })
    }

    // Determine who to pay and assign to
    let recipientUser = null
    let assignToUserId = null

    if (bid.driverId && bid.fleetManagerId) {
      // Fleet manager bid on behalf of driver
      recipientUser = await findUserById(bid.fleetManagerId)
      assignToUserId = bid.fleetManagerId // Assign to fleet manager, but track driver
    } else if (bid.truckerId) {
      // Regular trucker bid
      recipientUser = await findUserById(bid.truckerId)
      assignToUserId = bid.truckerId
    } else {
      return res.status(400).json({ 
        message: "Invalid bid: missing trucker or driver information" 
      })
    }

    // Check if bid amount is higher than what shipper already paid
    const bidAmount = parseFloat(bid.bidAmount || 0)
    const estimatedCost = parseFloat(shipment.estimatedCost || 0)
    const additionalAmount = bidAmount - estimatedCost

    // If bid amount is higher, deduct the difference from shipper's wallet
    if (additionalAmount > 0) {
      try {
        // Check shipper's wallet balance
        const shipperBalance = await getWalletBalance(userId)
        
        if (shipperBalance < additionalAmount) {
          return res.status(400).json({ 
            message: `Insufficient wallet balance. The bid amount (₦${bidAmount.toLocaleString()}) is ₦${additionalAmount.toLocaleString()} higher than the estimated cost (₦${estimatedCost.toLocaleString()}). Your current balance is ₦${shipperBalance.toLocaleString()}. Please fund your wallet.` 
          })
        }

        // Deduct the additional amount from shipper's wallet
        const timestamp = Date.now()
        const additionalDebitReference = `BID-ACCEPTED-ADDITIONAL-${timestamp}-${bid.shipmentId}-${bidId}`
        
        await createWalletTransaction(userId, {
          reference: additionalDebitReference,
          amount: additionalAmount,
          currency: "NGN",
          type: "debit",
          status: "success",
          description: `Additional payment for shipment #${bid.shipmentId} (Accepted Bid #${bidId}) - Bid amount (₦${bidAmount.toLocaleString()}) exceeds estimated cost (₦${estimatedCost.toLocaleString()})`,
          paystackReference: null,
          metadata: JSON.stringify({ 
            shipmentId: bid.shipmentId,
            bidId: bidId,
            bidAmount: bidAmount,
            estimatedCost: estimatedCost,
            additionalAmount: additionalAmount,
            source: "bid_accepted_additional"
          })
        })

        console.log(`✅ Additional amount debited from shipper ${userId}: ₦${additionalAmount} (Bid: ₦${bidAmount} - Estimated: ₦${estimatedCost}) for shipment #${bid.shipmentId}`)
      } catch (walletError) {
        console.error("Error debiting additional amount from shipper wallet:", walletError)
        return res.status(500).json({ 
          message: "Failed to process additional payment. Please try again." 
        })
      }
    }

    // Accept the bid and reject others
    await acceptBid(bidId, bid.shipmentId)

    // Assign to shipment (fleet manager or trucker)
    const success = await assignTruckerToShipment(bid.shipmentId, assignToUserId)
    
    if (!success) {
      return res.status(400).json({ message: "Failed to assign shipment" })
    }

    // Credit wallet balance - 5% on bid acceptance (cost to pick up stuff)
    if (bidAmount > 0) {
      try {
        const timestamp = Date.now()
        const creditAmount = bidAmount * 0.05 // 5% for pickup cost
        const creditReference = `BID-ACCEPTED-5PCT-${timestamp}-${bid.shipmentId}-${bidId}`
        const recipientId = bid.fleetManagerId || bid.truckerId
        
        await createWalletTransaction(recipientId, {
          reference: creditReference,
          amount: creditAmount,
          currency: "NGN",
          type: "credit",
          status: "success",
          description: `Payment received for shipment #${bid.shipmentId} (Accepted Bid #${bidId}) - 5% pickup cost${bid.driverId ? ` - Driver: ${bid.driverName || 'N/A'}` : ''}`,
          paystackReference: null,
          metadata: JSON.stringify({ 
            shipmentId: bid.shipmentId,
            bidId: bidId,
            driverId: bid.driverId || null,
            source: "bid_accepted",
            paymentStage: "accepted",
            percentage: 5,
            totalBidAmount: bidAmount,
            remainingAmount: bidAmount * 0.95
          })
        })

        console.log(`✅ Wallet credited for ${bid.fleetManagerId ? 'fleet manager' : 'trucker'} ${recipientId}: ₦${creditAmount} (5% of ₦${bidAmount}) for shipment #${bid.shipmentId} (Bid #${bidId})`)
      } catch (walletError) {
        console.error("Error crediting wallet:", walletError)
        // This is critical - if wallet credit fails, we should probably rollback the bid acceptance
        return res.status(500).json({ 
          message: "Failed to credit wallet. Please try again." 
        })
      }
    }

    const updatedBid = await getBidById(bidId)
    const updatedShipment = await getShipmentById(bid.shipmentId)

    // Send notification to bid recipient
    try {
      const recipientId = bid.fleetManagerId || bid.truckerId
      if (recipientId) {
        await notifyBidAccepted(updatedBid, updatedShipment, recipientId)
      }
    } catch (notifError) {
      console.error("Error sending bid acceptance notification:", notifError)
      // Don't fail the request if notification fails
    }

    let successMessage = "Bid accepted successfully. 5% payment (pickup cost) has been credited to the trucker's wallet balance. 60% will be credited upon pickup, and 35% upon completion."
    
    if (additionalAmount > 0) {
      successMessage += ` Additional amount of ₦${additionalAmount.toLocaleString()} has been deducted from your wallet.`
    }

    res.status(200).json({
      success: true,
      message: successMessage,
      bid: updatedBid,
      shipment: updatedShipment,
      additionalAmountDeducted: additionalAmount > 0 ? additionalAmount : 0
    })

  } catch (error) {
    console.error("Error accepting bid:", error)
    res.status(500).json({ 
      message: "Server error accepting bid", 
      error: error.message 
    })
  }
}

/**
 * Delete a bid (trucker can delete their own pending bid)
 */
export const deleteBidById = async (req, res) => {
  const userId = req.user.id
  const { bidId } = req.params
  
  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.role !== "trucker") {
      return res.status(403).json({ message: "Only truckers can delete their bids" })
    }

    const success = await deleteBid(bidId, userId)
    
    if (!success) {
      return res.status(400).json({ 
        message: "Failed to delete bid. It may not exist, belong to you, or is no longer pending." 
      })
    }

    res.status(200).json({
      success: true,
      message: "Bid deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting bid:", error)
    res.status(500).json({ 
      message: "Server error deleting bid", 
      error: error.message 
    })
  }
}

