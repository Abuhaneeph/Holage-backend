import express from 'express';
import { calculateStateDistance, estimateShippingCost } from '../utils/distanceCalculator.js';

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

export default router;

