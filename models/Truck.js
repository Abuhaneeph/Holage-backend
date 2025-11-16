import pool from "../config/db.js"

/**
 * Create a new truck
 */
export const createTruck = async (truckData) => {
  const {
    fleetManagerId,
    plateNumber,
    vehicleType,
    vehicleModel,
    vehicleYear,
    capacity,
    driverName,
    driverPhone,
    driverLicense,
    vehicleReg,
    status = 'active'
  } = truckData

  const query = `
    INSERT INTO trucks 
    (fleetManagerId, plateNumber, vehicleType, vehicleModel, vehicleYear, capacity, 
     driverName, driverPhone, driverLicense, vehicleReg, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `
  
  const [result] = await pool.execute(query, [
    fleetManagerId,
    plateNumber,
    vehicleType,
    vehicleModel || null,
    vehicleYear || null,
    capacity || null,
    driverName || null,
    driverPhone || null,
    driverLicense || null,
    vehicleReg || null,
    status
  ])
  
  return result.insertId
}

/**
 * Get truck by ID
 */
export const getTruckById = async (truckId) => {
  const query = `
    SELECT t.*, u.fullName as fleetManagerName, u.email as fleetManagerEmail
    FROM trucks t
    LEFT JOIN users u ON t.fleetManagerId = u.id
    WHERE t.id = ?
  `
  const [rows] = await pool.execute(query, [truckId])
  return rows[0]
}

/**
 * Get all trucks by fleet manager ID
 */
export const getTrucksByFleetManagerId = async (fleetManagerId, limit = 50, offset = 0) => {
  const limitInt = parseInt(limit, 10) || 50
  const offsetInt = parseInt(offset, 10) || 0
  
  const query = `
    SELECT * FROM trucks 
    WHERE fleetManagerId = ? 
    ORDER BY createdAt DESC 
    LIMIT ${limitInt} OFFSET ${offsetInt}
  `
  const [rows] = await pool.execute(query, [fleetManagerId])
  return rows
}

/**
 * Update truck
 */
export const updateTruck = async (truckId, fleetManagerId, truckData) => {
  const {
    plateNumber,
    vehicleType,
    vehicleModel,
    vehicleYear,
    capacity,
    driverName,
    driverPhone,
    driverLicense,
    vehicleReg,
    status
  } = truckData

  const query = `
    UPDATE trucks 
    SET plateNumber = ?, vehicleType = ?, vehicleModel = ?, vehicleYear = ?, 
        capacity = ?, driverName = ?, driverPhone = ?, driverLicense = ?, 
        vehicleReg = ?, status = ?, updatedAt = NOW()
    WHERE id = ? AND fleetManagerId = ?
  `
  
  const [result] = await pool.execute(query, [
    plateNumber,
    vehicleType,
    vehicleModel || null,
    vehicleYear || null,
    capacity || null,
    driverName || null,
    driverPhone || null,
    driverLicense || null,
    vehicleReg || null,
    status || 'active',
    truckId,
    fleetManagerId
  ])
  
  return result.affectedRows > 0
}

/**
 * Delete truck
 */
export const deleteTruck = async (truckId, fleetManagerId) => {
  const query = `
    DELETE FROM trucks 
    WHERE id = ? AND fleetManagerId = ?
  `
  const [result] = await pool.execute(query, [truckId, fleetManagerId])
  return result.affectedRows > 0
}

/**
 * Check if plate number already exists for this fleet manager
 */
export const checkPlateNumberExists = async (plateNumber, fleetManagerId, excludeTruckId = null) => {
  let query = `
    SELECT id FROM trucks 
    WHERE plateNumber = ? AND fleetManagerId = ?
  `
  const params = [plateNumber, fleetManagerId]
  
  if (excludeTruckId) {
    query += ` AND id != ?`
    params.push(excludeTruckId)
  }
  
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

