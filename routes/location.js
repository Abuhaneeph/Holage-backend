import express from 'express'
import {
  trackLocation,
  getCurrentShipmentLocation,
  getShipmentLocationHistory,
  getShipmentLocationTrail,
  getMyActiveLocations
} from '../controllers/locationController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

/**
 * @route   POST /api/location/track
 * @desc    Track current location for a shipment
 * @access  Private
 */
router.post('/track', protect, trackLocation)

/**
 * @route   GET /api/location/active
 * @desc    Get all active locations for current user
 * @access  Private
 */
router.get('/active', protect, getMyActiveLocations)

/**
 * @route   GET /api/location/shipment/:shipmentId/current
 * @desc    Get current location for a shipment
 * @access  Private
 */
router.get('/shipment/:shipmentId/current', protect, getCurrentShipmentLocation)

/**
 * @route   GET /api/location/shipment/:shipmentId/history
 * @desc    Get location history for a shipment
 * @access  Private
 */
router.get('/shipment/:shipmentId/history', protect, getShipmentLocationHistory)

/**
 * @route   GET /api/location/shipment/:shipmentId/trail
 * @desc    Get location trail for route visualization
 * @access  Private
 */
router.get('/shipment/:shipmentId/trail', protect, getShipmentLocationTrail)

export default router

