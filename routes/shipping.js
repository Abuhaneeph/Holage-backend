import express from 'express';
import { calculateStateDistance, estimateShippingCost } from '../utils/distanceCalculator.js';
import {
  createNewShipment,
  getMyShipments,
  getAvailableShipmentsForTruckers,
  getMyAssignedShipments,
  getShipmentDetails,
  acceptShipment,
  updateShipment,
  deleteShipmentById
} from '../controllers/shipmentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/shipping/calculate-distance
 * @desc    Calculate distance between two states
 * @access  Public
 */
router.post('/calculate-distance', async (req, res) => {
  try {
    const { pickupState, destinationState } = req.body;

    if (!pickupState || !destinationState) {
      return res.status(400).json({
        success: false,
        message: 'Both pickup state and destination state are required'
      });
    }

    const result = calculateStateDistance(pickupState, destinationState);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Distance calculation error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error calculating distance'
    });
  }
});

/**
 * @route   POST /api/shipping/estimate-cost
 * @desc    Estimate shipping cost based on distance and weight
 * @access  Public
 */
router.post('/estimate-cost', async (req, res) => {
  try {
    const { pickupState, destinationState, weight } = req.body;

    if (!pickupState || !destinationState) {
      return res.status(400).json({
        success: false,
        message: 'Both pickup state and destination state are required'
      });
    }

    // Calculate distance
    const distanceResult = calculateStateDistance(pickupState, destinationState);
    
    // Calculate cost
    const costEstimate = estimateShippingCost(distanceResult.distance, weight || 1);

    res.json({
      success: true,
      data: {
        route: distanceResult,
        cost: costEstimate
      }
    });

  } catch (error) {
    console.error('Cost estimation error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error estimating cost'
    });
  }
});

// ========================================
// SHIPMENT MANAGEMENT ENDPOINTS
// ========================================

/**
 * @route   POST /api/shipping/shipments
 * @desc    Create a new shipment (Shipper only)
 * @access  Private
 */
router.post('/shipments', protect, createNewShipment);

/**
 * @route   GET /api/shipping/shipments/my-shipments
 * @desc    Get all shipments for logged-in shipper
 * @access  Private (Shipper only)
 */
router.get('/shipments/my-shipments', protect, getMyShipments);

/**
 * @route   GET /api/shipping/shipments/available
 * @desc    Get all available shipments for truckers
 * @access  Private (Trucker only)
 */
router.get('/shipments/available', protect, getAvailableShipmentsForTruckers);

/**
 * @route   GET /api/shipping/shipments/my-jobs
 * @desc    Get all shipments assigned to logged-in trucker
 * @access  Private (Trucker only)
 */
router.get('/shipments/my-jobs', protect, getMyAssignedShipments);

/**
 * @route   GET /api/shipping/shipments/:shipmentId
 * @desc    Get a single shipment by ID
 * @access  Private
 */
router.get('/shipments/:shipmentId', protect, getShipmentDetails);

/**
 * @route   POST /api/shipping/shipments/:shipmentId/accept
 * @desc    Accept a shipment (Trucker only)
 * @access  Private (Trucker only)
 */
router.post('/shipments/:shipmentId/accept', protect, acceptShipment);

/**
 * @route   PATCH /api/shipping/shipments/:shipmentId
 * @desc    Update shipment status
 * @access  Private
 */
router.patch('/shipments/:shipmentId', protect, updateShipment);

/**
 * @route   DELETE /api/shipping/shipments/:shipmentId
 * @desc    Delete a shipment (only if pending)
 * @access  Private (Shipper only)
 */
router.delete('/shipments/:shipmentId', protect, deleteShipmentById);

export default router;

