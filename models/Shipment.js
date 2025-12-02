import pool from "../config/db.js"

/**
 * Helper function to clean shipment data - filter out "00" and "0" from LGA fields
 */
const cleanShipmentData = (shipment) => {
  if (!shipment) return shipment
  
  const cleaned = { ...shipment }
  
  // Filter out "00" and "0" from LGA fields - set to null
  if (cleaned.pickupLga === '00' || cleaned.pickupLga === '0' || cleaned.pickupLga === '') {
    cleaned.pickupLga = null
  }
  if (cleaned.destinationLga === '00' || cleaned.destinationLga === '0' || cleaned.destinationLga === '') {
    cleaned.destinationLga = null
  }
  
  return cleaned
}

/**
 * Create a new shipment
 */
export const createShipment = async (shipmentData) => {
  const {
    shipperId,
    pickupState,
    pickupLga,
    destinationState,
    destinationLga,
    cargoType,
    weight,
    truckType,
    pickupDate,
    fragileItems,
    insurance,
    distance,
    estimatedCost,
    estimatedDuration
  } = shipmentData

  const query = `
    INSERT INTO shipments 
    (shipperId, pickupState, pickupLga, destinationState, destinationLga, cargoType, weight, truckType, 
     pickupDate, fragileItems, insurance, distance, estimatedCost, estimatedDuration, 
     status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
  `
  
  const [result] = await pool.execute(query, [
    shipperId || null,
    pickupState || null,
    pickupLga || null,
    destinationState || null,
    destinationLga || null,
    cargoType || null,
    weight || null,
    truckType || null,
    pickupDate || null,
    fragileItems ? 1 : 0,
    insurance ? 1 : 0,
    distance || null,
    estimatedCost || null,
    estimatedDuration || null
  ])
  
  return result.insertId
}

/**
 * Get shipment by ID
 */
export const getShipmentById = async (shipmentId) => {
  const query = `
    SELECT s.*, u.fullName as shipperName, u.email as shipperEmail, u.phone as shipperPhone
    FROM shipments s
    LEFT JOIN users u ON s.shipperId = u.id
    WHERE s.id = ?
  `
  const [rows] = await pool.execute(query, [shipmentId])
  return rows[0] ? cleanShipmentData(rows[0]) : null
}

/**
 * Get all shipments by shipper ID
 */
export const getShipmentsByShipperId = async (shipperId, limit = 20, offset = 0) => {
  // Ensure limit and offset are integers
  const limitInt = parseInt(limit, 10)
  const offsetInt = parseInt(offset, 10)
  
  const query = `
    SELECT * FROM shipments 
    WHERE shipperId = ? 
    ORDER BY createdAt DESC 
    LIMIT ${limitInt} OFFSET ${offsetInt}
  `
  const [rows] = await pool.execute(query, [shipperId])
  return rows.map(cleanShipmentData)
}

/**
 * Get all available shipments for truckers (not yet assigned)
 * Supports filtering by pickupState, destinationState, and truckType
 */
export const getAvailableShipments = async (limit = 20, offset = 0, filters = {}) => {
  // Ensure limit and offset are integers
  const limitInt = parseInt(limit, 10)
  const offsetInt = parseInt(offset, 10)
  
  let query = `
    SELECT s.*, u.fullName as shipperName, u.phone as shipperPhone
    FROM shipments s
    LEFT JOIN users u ON s.shipperId = u.id
    WHERE s.status = 'pending' AND s.truckerId IS NULL
  `
  const params = []
  
  // Add filters
  if (filters.pickupState) {
    query += ` AND s.pickupState = ?`
    params.push(filters.pickupState)
  }
  
  if (filters.destinationState) {
    query += ` AND s.destinationState = ?`
    params.push(filters.destinationState)
  }
  
  if (filters.truckType) {
    query += ` AND s.truckType = ?`
    params.push(filters.truckType)
  }
  
  if (filters.cargoType) {
    query += ` AND s.cargoType = ?`
    params.push(filters.cargoType)
  }
  
  if (filters.weight) {
    // Filter by weight (allow approximate matches, e.g., within 0.5 tons)
    const weightValue = parseFloat(filters.weight)
    if (!isNaN(weightValue)) {
      query += ` AND ABS(s.weight - ?) <= 0.5`
      params.push(weightValue)
    }
  }
  
  query += ` ORDER BY s.createdAt DESC LIMIT ${limitInt} OFFSET ${offsetInt}`
  
  const [rows] = await pool.execute(query, params)
  return rows.map(cleanShipmentData)
}

/**
 * Get all shipments by trucker ID (assigned to them)
 */
export const getShipmentsByTruckerId = async (truckerId, limit = 20, offset = 0) => {
  // Ensure limit and offset are integers
  const limitInt = parseInt(limit, 10)
  const offsetInt = parseInt(offset, 10)
  
  const query = `
    SELECT s.*, u.fullName as shipperName, u.email as shipperEmail, u.phone as shipperPhone
    FROM shipments s
    LEFT JOIN users u ON s.shipperId = u.id
    WHERE s.truckerId = ? 
    ORDER BY s.createdAt DESC 
    LIMIT ${limitInt} OFFSET ${offsetInt}
  `
  const [rows] = await pool.execute(query, [truckerId])
  return rows.map(cleanShipmentData)
}

/**
 * Assign a trucker to a shipment
 */
export const assignTruckerToShipment = async (shipmentId, truckerId) => {
  const query = `
    UPDATE shipments 
    SET truckerId = ?, status = 'assigned', assignedAt = NOW()
    WHERE id = ? AND truckerId IS NULL
  `
  const [result] = await pool.execute(query, [truckerId, shipmentId])
  return result.affectedRows > 0
}

/**
 * Update shipment status
 */
export const updateShipmentStatus = async (shipmentId, status) => {
  const query = `
    UPDATE shipments 
    SET status = ?, updatedAt = NOW()
    WHERE id = ?
  `
  const [result] = await pool.execute(query, [status, shipmentId])
  return result.affectedRows > 0
}

/**
 * Confirm pickup by shipper
 */
export const confirmPickup = async (shipmentId) => {
  const query = `
    UPDATE shipments 
    SET pickupConfirmed = 1, pickupConfirmedAt = NOW(), updatedAt = NOW()
    WHERE id = ? AND pickupConfirmed = 0
  `
  const [result] = await pool.execute(query, [shipmentId])
  return result.affectedRows > 0
}

/**
 * Confirm delivery by shipper
 */
export const confirmDelivery = async (shipmentId) => {
  const query = `
    UPDATE shipments 
    SET deliveryConfirmed = 1, deliveryConfirmedAt = NOW(), updatedAt = NOW()
    WHERE id = ? AND deliveryConfirmed = 0
  `
  const [result] = await pool.execute(query, [shipmentId])
  return result.affectedRows > 0
}

/**
 * Delete a shipment (only if status is 'pending')
 */
export const deleteShipment = async (shipmentId, shipperId) => {
  const query = `
    DELETE FROM shipments 
    WHERE id = ? AND shipperId = ? AND status = 'pending'
  `
  const [result] = await pool.execute(query, [shipmentId, shipperId])
  return result.affectedRows > 0
}

