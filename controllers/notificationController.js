import {
  createNotification,
  createNotifications,
  getNotificationsByUserId,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationById
} from "../models/Notification.js"
import { findUserById } from "../models/User.js"

/**
 * Get all notifications for the current user
 */
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id
    const limit = parseInt(req.query.limit) || 50
    const offset = parseInt(req.query.offset) || 0
    const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined
    const type = req.query.type || null
    const category = req.query.category || null

    const notifications = await getNotificationsByUserId(userId, limit, offset, {
      isRead,
      type,
      category
    })

    const unreadCount = await getUnreadNotificationCount(userId)

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      total: notifications.length
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    res.status(500).json({
      message: "Server error fetching notifications",
      error: error.message
    })
  }
}

/**
 * Get unread notification count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id
    const count = await getUnreadNotificationCount(userId)

    res.status(200).json({
      success: true,
      unreadCount: count
    })
  } catch (error) {
    console.error("Error fetching unread count:", error)
    res.status(500).json({
      message: "Server error fetching unread count",
      error: error.message
    })
  }
}

/**
 * Mark notification as read
 */
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id
    const { notificationId } = req.params

    const success = await markNotificationAsRead(notificationId, userId)

    if (!success) {
      return res.status(404).json({
        message: "Notification not found or already read"
      })
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read"
    })
  } catch (error) {
    console.error("Error marking notification as read:", error)
    res.status(500).json({
      message: "Server error marking notification as read",
      error: error.message
    })
  }
}

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id
    const count = await markAllNotificationsAsRead(userId)

    res.status(200).json({
      success: true,
      message: `Marked ${count} notifications as read`,
      count
    })
  } catch (error) {
    console.error("Error marking all notifications as read:", error)
    res.status(500).json({
      message: "Server error marking all notifications as read",
      error: error.message
    })
  }
}

/**
 * Delete a notification
 */
export const deleteMyNotification = async (req, res) => {
  try {
    const userId = req.user.id
    const { notificationId } = req.params

    const success = await deleteNotification(notificationId, userId)

    if (!success) {
      return res.status(404).json({
        message: "Notification not found"
      })
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted"
    })
  } catch (error) {
    console.error("Error deleting notification:", error)
    res.status(500).json({
      message: "Server error deleting notification",
      error: error.message
    })
  }
}

/**
 * Get a single notification by ID
 */
export const getNotification = async (req, res) => {
  try {
    const userId = req.user.id
    const { notificationId } = req.params

    const notification = await getNotificationById(notificationId, userId)

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found"
      })
    }

    // Mark as read when viewed
    if (!notification.isRead) {
      await markNotificationAsRead(notificationId, userId)
      notification.isRead = 1
    }

    res.status(200).json({
      success: true,
      notification
    })
  } catch (error) {
    console.error("Error fetching notification:", error)
    res.status(500).json({
      message: "Server error fetching notification",
      error: error.message
    })
  }
}

