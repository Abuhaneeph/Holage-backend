import express from 'express';
import {
  submitBid,
  getShipmentBids,
  getMyBids,
  acceptBidForShipment,
  deleteBidById
} from '../controllers/bidController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/bids
 * @desc    Submit a bid for a shipment (Trucker only)
 * @access  Private (Trucker only)
 */
router.post('/', protect, submitBid);

/**
 * @route   GET /api/bids/shipment/:shipmentId
 * @desc    Get all bids for a shipment (Shipper only)
 * @access  Private (Shipper only)
 */
router.get('/shipment/:shipmentId', protect, getShipmentBids);

/**
 * @route   GET /api/bids/my-bids
 * @desc    Get all bids by the logged-in trucker
 * @access  Private (Trucker only)
 */
router.get('/my-bids', protect, getMyBids);

/**
 * @route   POST /api/bids/:bidId/accept
 * @desc    Accept a bid (Shipper only)
 * @access  Private (Shipper only)
 */
router.post('/:bidId/accept', protect, acceptBidForShipment);

/**
 * @route   DELETE /api/bids/:bidId
 * @desc    Delete a bid (Trucker only - their own pending bid)
 * @access  Private (Trucker only)
 */
router.delete('/:bidId', protect, deleteBidById);

export default router;

