import pool from "../config/db.js"

/**
 * Create a new shipment
 */
export const createShipment = async (shipmentData) => {
  const {
    shipperId,
    pickupState,
    destinationState,
    cargoType,
    weight,
    truckType,
    pickupDate,
    fragileItems,
    distance,
    estimatedCost,
    estimatedDuration
  } = shipmentData

  const query = `
    INSERT INTO shipments 
    (shipperId, pickupState, destinationState, cargoType, weight, truckType, 
     pickupDate, fragileItems, distance, estimatedCost, estimatedDuration, 
     status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
  `
  
  const [result] = await pool.execute(query, [
    shipperId || null,
    pickupState || null,
    destinationState || null,
    cargoType || null,
    weight || null,
    truckType || null,
    pickupDate || null,
    fragileItems ? 1 : 0,
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
  return rows[0]
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
  return rows
}

/**
 * Get all available shipments for truckers (not yet assigned)
 */
export const getAvailableShipments = async (limit = 20, offset = 0) => {
  // Ensure limit and offset are integers
  const limitInt = parseInt(limit, 10)
  const offsetInt = parseInt(offset, 10)
  
  const query = `
    SELECT s.*, u.fullName as shipperName, u.phone as shipperPhone
    FROM shipments s
    LEFT JOIN users u ON s.shipperId = u.id
    WHERE s.status = 'pending' AND s.truckerId IS NULL
    ORDER BY s.createdAt DESC 
    LIMIT ${limitInt} OFFSET ${offsetInt}
  `
  const [rows] = await pool.execute(query, [])
  return rows
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
  return rows
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

