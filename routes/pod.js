import express from 'express'
import {
  createPOD,
  uploadPODPhotos,
  getPOD,
  getShipmentPODs,
  getMyPODs,
  deletePODDocument
} from '../controllers/podController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

/**
 * @route   POST /api/pod/:shipmentId
 * @desc    Create or update POD document (with file upload)
 * @access  Private
 */
router.post('/:shipmentId', protect, uploadPODPhotos, createPOD)

/**
 * @route   GET /api/pod/:shipmentId/:podType
 * @desc    Get POD by shipment and type
 * @access  Private
 */
router.get('/:shipmentId/:podType', protect, getPOD)

/**
 * @route   GET /api/pod/:shipmentId
 * @desc    Get all PODs for a shipment
 * @access  Private
 */
router.get('/:shipmentId', protect, getShipmentPODs)

/**
 * @route   GET /api/pod/my-pods
 * @desc    Get PODs created by current user
 * @access  Private
 */
router.get('/my-pods', protect, getMyPODs)

/**
 * @route   DELETE /api/pod/:podId
 * @desc    Delete a POD document
 * @access  Private
 */
router.delete('/:podId', protect, deletePODDocument)

export default router

