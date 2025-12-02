import express from 'express'
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteMyNotification,
  getNotification
} from '../controllers/notificationController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for current user
 * @access  Private
 */
router.get('/', protect, getMyNotifications)

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', protect, getUnreadCount)

/**
 * @route   GET /api/notifications/:notificationId
 * @desc    Get a single notification by ID
 * @access  Private
 */
router.get('/:notificationId', protect, getNotification)

/**
 * @route   PATCH /api/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch('/:notificationId/read', protect, markAsRead)

/**
 * @route   PATCH /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/mark-all-read', protect, markAllAsRead)

/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:notificationId', protect, deleteMyNotification)

export default router

