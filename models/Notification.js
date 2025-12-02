import pool from "../config/db.js"

/**
 * Create a new notification
 */
export const createNotification = async (notificationData) => {
  const {
    userId,
    title,
    message,
    type = 'info',
    category = 'general',
    relatedId = null,
    relatedType = null,
    actionUrl = null,
    metadata = null
  } = notificationData

  const query = `
    INSERT INTO notifications 
    (userId, title, message, type, category, relatedId, relatedType, actionUrl, metadata, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `
  
  const [result] = await pool.execute(query, [
    userId,
    title,
    message,
    type,
    category,
    relatedId,
    relatedType,
    actionUrl,
    metadata ? JSON.stringify(metadata) : null
  ])
  
  return result.insertId
}

/**
 * Create multiple notifications (for bulk operations)
 */
export const createNotifications = async (notifications) => {
  if (!notifications || notifications.length === 0) return []

  const values = []
  const placeholders = []
  
  for (const notif of notifications) {
    placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())')
    values.push(
      notif.userId,
      notif.title,
      notif.message,
      notif.type || 'info',
      notif.category || 'general',
      notif.relatedId || null,
      notif.relatedType || null,
      notif.actionUrl || null,
      notif.metadata ? JSON.stringify(notif.metadata) : null
    )
  }

  const query = `
    INSERT INTO notifications 
    (userId, title, message, type, category, relatedId, relatedType, actionUrl, metadata, createdAt)
    VALUES ${placeholders.join(', ')}
  `
  
  const [result] = await pool.execute(query, values)
  return result.insertId
}

/**
 * Get notifications for a user
 */
export const getNotificationsByUserId = async (userId, limit = 50, offset = 0, filters = {}) => {
  let query = `
    SELECT * FROM notifications 
    WHERE userId = ?
  `
  const params = [userId]

  if (filters.isRead !== undefined) {
    query += ` AND isRead = ?`
    params.push(filters.isRead ? 1 : 0)
  }

  if (filters.type) {
    query += ` AND type = ?`
    params.push(filters.type)
  }

  if (filters.category) {
    query += ` AND category = ?`
    params.push(filters.category)
  }

  // Ensure limit and offset are proper integers (MySQL doesn't accept placeholders for LIMIT/OFFSET)
  const limitInt = Number.isInteger(limit) ? limit : parseInt(limit, 10) || 50
  const offsetInt = Number.isInteger(offset) ? offset : parseInt(offset, 10) || 0
  
  // Validate and sanitize to prevent SQL injection
  const safeLimit = Math.max(1, Math.min(limitInt, 1000)) // Between 1 and 1000
  const safeOffset = Math.max(0, offsetInt) // Non-negative
  
  query += ` ORDER BY createdAt DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`

  const [rows] = await pool.execute(query, params)
  
  // Parse JSON metadata (handle both string and already-parsed object cases)
  return rows.map(row => {
    let parsedMetadata = null
    if (row.metadata) {
      if (typeof row.metadata === 'string') {
        try {
          parsedMetadata = JSON.parse(row.metadata)
        } catch (e) {
          console.error('Error parsing metadata JSON:', e)
          parsedMetadata = null
        }
      } else {
        // Already an object (MySQL JSON column auto-parsed)
        parsedMetadata = row.metadata
      }
    }
    return {
      ...row,
      metadata: parsedMetadata
    }
  })
}

/**
 * Get unread notification count for a user
 */
export const getUnreadNotificationCount = async (userId) => {
  const query = `
    SELECT COUNT(*) as count FROM notifications 
    WHERE userId = ? AND isRead = 0
  `
  const [rows] = await pool.execute(query, [userId])
  return rows[0]?.count || 0
}

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  const query = `
    UPDATE notifications 
    SET isRead = 1, readAt = NOW() 
    WHERE id = ? AND userId = ?
  `
  const [result] = await pool.execute(query, [notificationId, userId])
  return result.affectedRows > 0
}

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (userId) => {
  const query = `
    UPDATE notifications 
    SET isRead = 1, readAt = NOW() 
    WHERE userId = ? AND isRead = 0
  `
  const [result] = await pool.execute(query, [userId])
  return result.affectedRows
}

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId, userId) => {
  const query = `
    DELETE FROM notifications 
    WHERE id = ? AND userId = ?
  `
  const [result] = await pool.execute(query, [notificationId, userId])
  return result.affectedRows > 0
}

/**
 * Get notification by ID
 */
export const getNotificationById = async (notificationId, userId) => {
  const query = `
    SELECT * FROM notifications 
    WHERE id = ? AND userId = ?
  `
  const [rows] = await pool.execute(query, [notificationId, userId])
  
  if (rows.length === 0) return null
  
  const row = rows[0]
  
  // Parse JSON metadata (handle both string and already-parsed object cases)
  let parsedMetadata = null
  if (row.metadata) {
    if (typeof row.metadata === 'string') {
      try {
        parsedMetadata = JSON.parse(row.metadata)
      } catch (e) {
        console.error('Error parsing metadata JSON:', e)
        parsedMetadata = null
      }
    } else {
      // Already an object (MySQL JSON column auto-parsed)
      parsedMetadata = row.metadata
    }
  }
  
  return {
    ...row,
    metadata: parsedMetadata
  }
}

