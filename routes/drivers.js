import express from 'express';
import {
  registerDriver,
  getMyDrivers,
  getDriver,
  updateDriverById,
  deleteDriverById,
  driverLogin,
  registerDriverWithTruck,
  uploadTruckImage
} from '../controllers/driverController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/drivers/login
 * @desc    Driver login (public endpoint)
 * @access  Public
 */
router.post('/login', driverLogin);

/**
 * @route   POST /api/drivers/register-with-truck
 * @desc    Register a driver and truck together (Fleet Manager only)
 * @access  Private (Fleet Manager only)
 */
router.post('/register-with-truck', protect, uploadTruckImage, registerDriverWithTruck);

/**
 * @route   POST /api/drivers
 * @desc    Register a new driver (Fleet Manager only)
 * @access  Private (Fleet Manager only)
 */
router.post('/', protect, registerDriver);

/**
 * @route   GET /api/drivers
 * @desc    Get all drivers for the logged-in fleet manager
 * @access  Private (Fleet Manager only)
 */
router.get('/', protect, getMyDrivers);

/**
 * @route   GET /api/drivers/:driverId
 * @desc    Get a single driver by ID
 * @access  Private (Fleet Manager only)
 */
router.get('/:driverId', protect, getDriver);

/**
 * @route   PUT /api/drivers/:driverId
 * @desc    Update a driver
 * @access  Private (Fleet Manager only)
 */
router.put('/:driverId', protect, updateDriverById);

/**
 * @route   DELETE /api/drivers/:driverId
 * @desc    Delete a driver
 * @access  Private (Fleet Manager only)
 */
router.delete('/:driverId', protect, deleteDriverById);

export default router;

