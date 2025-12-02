import pool from "../config/db.js"

/**
 * Create a new bid for a shipment
 */
export const createBid = async (bidData) => {
  const {
    shipmentId,
    truckerId,
    bidAmount,
    message,
    driverId,
    fleetManagerId
  } = bidData

  const query = `
    INSERT INTO shipment_bids 
    (shipmentId, truckerId, bidAmount, message, driverId, fleetManagerId, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
  `
  
  const [result] = await pool.execute(query, [
    shipmentId,
    truckerId || null,
    bidAmount,
    message || null,
    driverId || null,
    fleetManagerId || null
  ])
  
  return result.insertId
}

/**
 * Get bid by ID
 */
export const getBidById = async (bidId) => {
  const query = `
    SELECT b.*, 
           u.fullName as truckerName, 
           u.email as truckerEmail, 
           u.phone as truckerPhone,
           s.estimatedCost as shipmentEstimatedCost
    FROM shipment_bids b
    LEFT JOIN users u ON b.truckerId = u.id
    LEFT JOIN shipments s ON b.shipmentId = s.id
    WHERE b.id = ?
  `
  const [rows] = await pool.execute(query, [bidId])
  return rows[0]
}

/**
 * Get all bids for a shipment
 */
export const getBidsByShipmentId = async (shipmentId) => {
  const query = `
    SELECT b.*, 
           u.fullName as truckerName, 
           u.email as truckerEmail, 
           u.phone as truckerPhone,
           u.bankAccountNumber,
           u.bankCode,
           u.bankName,
           d.driverName,
           d.phoneNumber as driverPhone,
           fm.fullName as fleetManagerName,
           fm.phone as fleetManagerPhone
    FROM shipment_bids b
    LEFT JOIN users u ON b.truckerId = u.id
    LEFT JOIN drivers d ON b.driverId = d.id
    LEFT JOIN users fm ON b.fleetManagerId = fm.id
    WHERE b.shipmentId = ?
    ORDER BY b.bidAmount ASC, b.createdAt ASC
  `
  const [rows] = await pool.execute(query, [shipmentId])
  return rows
}

/**
 * Get all bids by a trucker
 */
export const getBidsByTruckerId = async (truckerId) => {
  const query = `
    SELECT b.*, 
           s.pickupState,
           s.pickupLga,
           s.destinationState,
           s.destinationLga,
           s.cargoType,
           s.weight,
           s.truckType,
           s.pickupDate,
           s.estimatedCost as shipmentEstimatedCost,
           s.status as shipmentStatus,
           s.pickupConfirmed,
           s.deliveryConfirmed,
           u.fullName as shipperName
    FROM shipment_bids b
    LEFT JOIN shipments s ON b.shipmentId = s.id
    LEFT JOIN users u ON s.shipperId = u.id
    WHERE b.truckerId = ?
    ORDER BY b.createdAt DESC
  `
  const [rows] = await pool.execute(query, [truckerId])
  return rows
}

/**
 * Get all bids by a driver
 */
export const getBidsByDriverId = async (driverId) => {
  const query = `
    SELECT b.*, 
           s.pickupState,
           s.pickupLga,
           s.destinationState,
           s.destinationLga,
           s.cargoType,
           s.weight,
           s.truckType,
           s.pickupDate,
           s.distance,
           s.estimatedCost as shipmentEstimatedCost,
           s.status as shipmentStatus,
           s.shipperId,
           s.pickupConfirmed,
           s.deliveryConfirmed,
           u.fullName as shipperName,
           u.phone as shipperPhone,
           fm.fullName as fleetManagerName,
           fm.phone as fleetManagerPhone
    FROM shipment_bids b
    LEFT JOIN shipments s ON b.shipmentId = s.id
    LEFT JOIN users u ON s.shipperId = u.id
    LEFT JOIN users fm ON b.fleetManagerId = fm.id
    WHERE b.driverId = ?
    ORDER BY b.createdAt DESC
  `
  const [rows] = await pool.execute(query, [driverId])
  return rows
}

/**
 * Get all bids by a fleet manager
 */
export const getBidsByFleetManagerId = async (fleetManagerId) => {
  const query = `
    SELECT b.*, 
           s.pickupState,
           s.pickupLga,
           s.destinationState,
           s.destinationLga,
           s.cargoType,
           s.weight,
           s.truckType,
           s.pickupDate,
           s.estimatedCost as shipmentEstimatedCost,
           s.status as shipmentStatus,
           s.pickupConfirmed,
           s.deliveryConfirmed,
           u.fullName as shipperName,
           u.phone as shipperPhone,
           d.driverName,
           d.phoneNumber as driverPhone
    FROM shipment_bids b
    LEFT JOIN shipments s ON b.shipmentId = s.id
    LEFT JOIN users u ON s.shipperId = u.id
    LEFT JOIN drivers d ON b.driverId = d.id
    WHERE b.fleetManagerId = ?
    ORDER BY b.createdAt DESC
  `
  const [rows] = await pool.execute(query, [fleetManagerId])
  return rows
}

/**
 * Check if trucker has already bid on a shipment
 */
export const checkExistingBid = async (shipmentId, truckerId) => {
  const query = `
    SELECT * FROM shipment_bids
    WHERE shipmentId = ? AND truckerId = ?
  `
  const [rows] = await pool.execute(query, [shipmentId, truckerId])
  return rows[0] || null
}

/**
 * Check if fleet manager has already bid for a driver on a shipment
 */
export const checkExistingFleetManagerBid = async (shipmentId, fleetManagerId, driverId) => {
  const query = `
    SELECT * FROM shipment_bids
    WHERE shipmentId = ? AND fleetManagerId = ? AND driverId = ?
  `
  const [rows] = await pool.execute(query, [shipmentId, fleetManagerId, driverId])
  return rows[0] || null
}

/**
 * Accept a bid (update bid status and reject all other bids for the shipment)
 */
export const acceptBid = async (bidId, shipmentId) => {
  const connection = await pool.getConnection()
  
  try {
    await connection.beginTransaction()
    
    // Accept the selected bid
    const acceptQuery = `
      UPDATE shipment_bids 
      SET status = 'accepted', acceptedAt = NOW(), updatedAt = NOW()
      WHERE id = ? AND shipmentId = ?
    `
    await connection.execute(acceptQuery, [bidId, shipmentId])
    
    // Reject all other bids for this shipment
    const rejectQuery = `
      UPDATE shipment_bids 
      SET status = 'rejected', updatedAt = NOW()
      WHERE shipmentId = ? AND id != ? AND status = 'pending'
    `
    await connection.execute(rejectQuery, [shipmentId, bidId])
    
    await connection.commit()
    return true
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Update bid status
 */
export const updateBidStatus = async (bidId, status) => {
  const query = `
    UPDATE shipment_bids 
    SET status = ?, updatedAt = NOW()
    WHERE id = ?
  `
  const [result] = await pool.execute(query, [status, bidId])
  return result.affectedRows > 0
}

/**
 * Delete a bid (only if status is pending)
 */
export const deleteBid = async (bidId, truckerId) => {
  const query = `
    DELETE FROM shipment_bids
    WHERE id = ? AND truckerId = ? AND status = 'pending'
  `
  const [result] = await pool.execute(query, [bidId, truckerId])
  return result.affectedRows > 0
}

/**
 * Get accepted bid for a shipment
 */
export const getAcceptedBidByShipmentId = async (shipmentId) => {
  const query = `
    SELECT b.*, 
           u.fullName as truckerName, 
           u.email as truckerEmail, 
           u.phone as truckerPhone,
           d.driverName,
           d.phoneNumber as driverPhone,
           fm.fullName as fleetManagerName,
           fm.phone as fleetManagerPhone
    FROM shipment_bids b
    LEFT JOIN users u ON b.truckerId = u.id
    LEFT JOIN drivers d ON b.driverId = d.id
    LEFT JOIN users fm ON b.fleetManagerId = fm.id
    WHERE b.shipmentId = ? AND b.status = 'accepted'
    LIMIT 1
  `
  const [rows] = await pool.execute(query, [shipmentId])
  return rows[0] || null
}

