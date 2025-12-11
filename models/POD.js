import pool from "../config/db.js"

/**
 * Create or update a POD document
 */
export const createOrUpdatePOD = async (podData) => {
  const {
    shipmentId,
    userId,
    podType, // 'pickup' or 'delivery'
    photos = null,
    signatureData = null,
    signatureName = null,
    signaturePhone = null,
    notes = null,
    latitude = null,
    longitude = null,
    address = null
  } = podData

  // Check if POD already exists
  const [existing] = await pool.execute(
    `SELECT id FROM pod_documents WHERE shipmentId = ? AND podType = ?`,
    [shipmentId, podType]
  )

  if (existing.length > 0) {
    // Update existing POD
    const query = `
      UPDATE pod_documents 
      SET photos = ?, signatureData = ?, signatureName = ?, signaturePhone = ?, 
          notes = ?, latitude = ?, longitude = ?, address = ?, updatedAt = NOW()
      WHERE shipmentId = ? AND podType = ?
    `
    const [result] = await pool.execute(query, [
      photos ? JSON.stringify(photos) : null,
      signatureData,
      signatureName,
      signaturePhone,
      notes,
      latitude,
      longitude,
      address,
      shipmentId,
      podType
    ])
    return existing[0].id
  } else {
    // Create new POD
    const query = `
      INSERT INTO pod_documents 
      (shipmentId, userId, podType, photos, signatureData, signatureName, signaturePhone, 
       notes, latitude, longitude, address, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `
    const [result] = await pool.execute(query, [
      shipmentId,
      userId,
      podType,
      photos ? JSON.stringify(photos) : null,
      signatureData,
      signatureName,
      signaturePhone,
      notes,
      latitude,
      longitude,
      address
    ])
    return result.insertId
  }
}

/**
 * Helper function to safely parse photos field
 */
const parsePhotos = (photos) => {
  if (!photos) return []
  
  // If it's already an array/object, return as is
  if (Array.isArray(photos)) return photos
  if (typeof photos === 'object') return photos
  
  // If it's a string, try to parse as JSON
  if (typeof photos === 'string') {
    // Check if it looks like a file path (starts with /)
    if (photos.startsWith('/') || photos.startsWith('http')) {
      // It's a single file path, return as array
      return [photos]
    }
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(photos)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch (e) {
      // If parsing fails, treat as single file path
      return [photos]
    }
  }
  
  return []
}

/**
 * Get POD by shipment ID and type
 */
export const getPODByShipmentAndType = async (shipmentId, podType) => {
  const query = `
    SELECT * FROM pod_documents 
    WHERE shipmentId = ? AND podType = ?
  `
  const [rows] = await pool.execute(query, [shipmentId, podType])
  
  if (rows.length === 0) return null
  
  const row = rows[0]
  return {
    ...row,
    photos: parsePhotos(row.photos)
  }
}

/**
 * Get all PODs for a shipment
 */
export const getPODsByShipmentId = async (shipmentId) => {
  const query = `
    SELECT * FROM pod_documents 
    WHERE shipmentId = ?
    ORDER BY podType, createdAt DESC
  `
  const [rows] = await pool.execute(query, [shipmentId])
  
  return rows.map(row => ({
    ...row,
    photos: parsePhotos(row.photos)
  }))
}

/**
 * Get PODs by user ID
 */
export const getPODsByUserId = async (userId, limit = 50, offset = 0) => {
  const query = `
    SELECT * FROM pod_documents 
    WHERE userId = ?
    ORDER BY createdAt DESC
    LIMIT ? OFFSET ?
  `
  const [rows] = await pool.execute(query, [userId, parseInt(limit), parseInt(offset)])
  
  return rows.map(row => ({
    ...row,
    photos: parsePhotos(row.photos)
  }))
}

/**
 * Delete POD
 */
export const deletePOD = async (podId, userId) => {
  const query = `
    DELETE FROM pod_documents 
    WHERE id = ? AND userId = ?
  `
  const [result] = await pool.execute(query, [podId, userId])
  return result.affectedRows > 0
}

