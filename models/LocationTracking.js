import pool from "../config/db.js"

/**
 * Create a new location tracking entry
 */
export const createLocationTracking = async (locationData) => {
  const {
    shipmentId,
    userId,
    latitude,
    longitude,
    accuracy = null,
    speed = null,
    heading = null,
    address = null,
    batteryLevel = null
  } = locationData

  // Mark previous active locations for this shipment as inactive
  await pool.execute(
    `UPDATE location_tracking SET isActive = 0 
     WHERE shipmentId = ? AND userId = ? AND isActive = 1`,
    [shipmentId, userId]
  )

  // Create new active location
  const query = `
    INSERT INTO location_tracking 
    (shipmentId, userId, latitude, longitude, accuracy, speed, heading, address, batteryLevel, isActive, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
  `
  
  const [result] = await pool.execute(query, [
    shipmentId,
    userId,
    latitude,
    longitude,
    accuracy,
    speed,
    heading,
    address,
    batteryLevel
  ])
  
  return result.insertId
}

/**
 * Get current active location for a shipment
 */
export const getCurrentLocation = async (shipmentId, userId = null) => {
  let query = `
    SELECT * FROM location_tracking 
    WHERE shipmentId = ? AND isActive = 1
  `
  const params = [shipmentId]

  if (userId) {
    query += ` AND userId = ?`
    params.push(userId)
  }

  query += ` ORDER BY createdAt DESC LIMIT 1`

  const [rows] = await pool.execute(query, params)
  return rows[0] || null
}

/**
 * Get location history for a shipment
 */
export const getLocationHistory = async (shipmentId, limit = 100, offset = 0) => {
  // Ensure limit and offset are proper integers (MySQL doesn't accept placeholders for LIMIT/OFFSET)
  const limitInt = Number.isInteger(limit) ? limit : parseInt(limit, 10) || 100
  const offsetInt = Number.isInteger(offset) ? offset : parseInt(offset, 10) || 0
  
  // Validate and sanitize to prevent SQL injection
  const safeLimit = Math.max(1, Math.min(limitInt, 1000)) // Between 1 and 1000
  const safeOffset = Math.max(0, offsetInt) // Non-negative
  
  const query = `
    SELECT * FROM location_tracking 
    WHERE shipmentId = ?
    ORDER BY createdAt DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `
  const [rows] = await pool.execute(query, [shipmentId])
  return rows
}

/**
 * Get all active locations for a user
 */
export const getActiveLocationsByUserId = async (userId) => {
  const query = `
    SELECT lt.*, s.pickupState, s.destinationState, s.status as shipmentStatus
    FROM location_tracking lt
    LEFT JOIN shipments s ON lt.shipmentId = s.id
    WHERE lt.userId = ? AND lt.isActive = 1
    ORDER BY lt.createdAt DESC
  `
  const [rows] = await pool.execute(query, [userId])
  return rows
}

/**
 * Get location trail (for route visualization)
 */
export const getLocationTrail = async (shipmentId, startTime = null, endTime = null) => {
  let query = `
    SELECT * FROM location_tracking 
    WHERE shipmentId = ?
  `
  const params = [shipmentId]

  if (startTime) {
    query += ` AND createdAt >= ?`
    params.push(startTime)
  }

  if (endTime) {
    query += ` AND createdAt <= ?`
    params.push(endTime)
  }

  query += ` ORDER BY createdAt ASC`

  const [rows] = await pool.execute(query, params)
  return rows
}

/**
 * Delete old location tracking data (cleanup)
 */
export const deleteOldLocations = async (daysOld = 30) => {
  const query = `
    DELETE FROM location_tracking 
    WHERE isActive = 0 AND createdAt < DATE_SUB(NOW(), INTERVAL ? DAY)
  `
  const [result] = await pool.execute(query, [daysOld])
  return result.affectedRows
}

