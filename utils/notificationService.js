import {
  createNotification,
  createNotifications
} from "../models/Notification.js"
import { findUserById } from "../models/User.js"
import { getDriverById } from "../models/Driver.js"

/**
 * Send notification to a single user
 */
export const sendNotification = async (userId, notificationData) => {
  try {
    const notificationId = await createNotification({
      userId,
      ...notificationData
    })
    return notificationId
  } catch (error) {
    console.error("Error sending notification:", error)
    throw error
  }
}

/**
 * Send notifications to multiple users
 */
export const sendBulkNotifications = async (notifications) => {
  try {
    const notificationIds = await createNotifications(notifications)
    return notificationIds
  } catch (error) {
    console.error("Error sending bulk notifications:", error)
    throw error
  }
}

/**
 * Send shipment status notification
 */
export const notifyShipmentStatusChange = async (shipment, oldStatus, newStatus, recipients) => {
  const statusMessages = {
    'assigned': {
      title: 'Shipment Assigned',
      message: `Your shipment #${shipment.id} has been assigned to a driver.`,
      type: 'success',
      category: 'shipment'
    },
    'picking_up': {
      title: 'Driver En Route to Pickup',
      message: `Driver is on the way to pick up shipment #${shipment.id}.`,
      type: 'info',
      category: 'shipment'
    },
    'picked_up': {
      title: 'Pickup Completed - Confirmation Needed',
      message: `Shipment #${shipment.id} has been picked up. Please confirm to release payment.`,
      type: 'warning',
      category: 'shipment'
    },
    'in_transit': {
      title: 'Shipment In Transit',
      message: `Shipment #${shipment.id} is now in transit to destination.`,
      type: 'info',
      category: 'shipment'
    },
    'delivered': {
      title: 'Delivery Completed - Confirmation Needed',
      message: `Shipment #${shipment.id} has been delivered. Please confirm to release final payment.`,
      type: 'warning',
      category: 'shipment'
    }
  }

  const notificationData = statusMessages[newStatus]
  if (!notificationData) return

  // Filter recipients to only include users that exist in the users table
  // Drivers are in a separate table and cannot receive notifications directly
  // Instead, we'll send notifications to their fleet manager
  const validRecipients = []
  
  for (const userId of recipients) {
    const user = await findUserById(userId)
    if (user) {
      // User exists in users table
      validRecipients.push(userId)
    } else {
      // Check if it's a driver - if so, get their fleet manager
      const driver = await getDriverById(userId)
      if (driver && driver.fleetManagerId) {
        // Add fleet manager instead of driver
        if (!validRecipients.includes(driver.fleetManagerId)) {
          validRecipients.push(driver.fleetManagerId)
        }
      }
    }
  }

  // Remove duplicates
  const uniqueRecipients = [...new Set(validRecipients)]

  const notifications = uniqueRecipients.map(userId => ({
    userId,
    title: notificationData.title,
    message: notificationData.message,
    type: notificationData.type,
    category: notificationData.category,
    relatedId: shipment.id,
    relatedType: 'shipment',
    actionUrl: `/shipments/${shipment.id}`
  }))

  if (notifications.length > 0) {
    await sendBulkNotifications(notifications)
  }
}

/**
 * Send bid acceptance notification
 */
export const notifyBidAccepted = async (bid, shipment, recipientId) => {
  await sendNotification(recipientId, {
    title: 'Bid Accepted! 🎉',
    message: `Your bid of ₦${parseFloat(bid.bidAmount).toLocaleString('en-NG')} for shipment #${shipment.id} has been accepted!`,
    type: 'success',
    category: 'bid',
    relatedId: bid.id,
    relatedType: 'bid',
    actionUrl: `/shipments/${shipment.id}`,
    metadata: {
      bidId: bid.id,
      shipmentId: shipment.id,
      bidAmount: bid.bidAmount
    }
  })
}

/**
 * Send payment notification
 */
export const notifyPayment = async (userId, amount, type, description, metadata = {}) => {
  await sendNotification(userId, {
    title: type === 'credit' ? 'Payment Received 💰' : 'Payment Deducted',
    message: description || `${type === 'credit' ? 'Received' : 'Deducted'} ₦${parseFloat(amount).toLocaleString('en-NG')}`,
    type: type === 'credit' ? 'success' : 'info',
    category: 'payment',
    relatedId: metadata.transactionId || null,
    relatedType: 'transaction',
    actionUrl: '/wallet',
    metadata
  })
}

/**
 * Send new bid notification to shipper
 */
export const notifyNewBid = async (shipperId, bid, shipment) => {
  await sendNotification(shipperId, {
    title: 'New Bid Received',
    message: `You received a new bid of ₦${parseFloat(bid.bidAmount).toLocaleString('en-NG')} for shipment #${shipment.id}`,
    type: 'info',
    category: 'bid',
    relatedId: bid.id,
    relatedType: 'bid',
    actionUrl: `/shipments/${shipment.id}`,
    metadata: {
      bidId: bid.id,
      shipmentId: shipment.id,
      bidAmount: bid.bidAmount
    }
  })
}

