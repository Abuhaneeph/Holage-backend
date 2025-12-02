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
    status = 'active',
    quantity = 1,
    driverId = null,
    product = null,
    description = null,
    type = null,
    color = null,
    imageUrl = null,
    notes = null
  } = truckData

  // If quantity > 1, create multiple truck records
  const truckIds = []
  const basePlateNumber = plateNumber
  
  for (let i = 0; i < quantity; i++) {
    const currentPlateNumber = quantity > 1 ? `${basePlateNumber}-${i + 1}` : basePlateNumber
    
    const query = `
      INSERT INTO trucks 
      (fleetManagerId, plateNumber, vehicleType, vehicleModel, vehicleYear, capacity, 
       driverName, driverPhone, driverLicense, vehicleReg, status, driverId,
       product, description, type, color, imageUrl, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `
    
    const [result] = await pool.execute(query, [
      fleetManagerId,
      currentPlateNumber,
      vehicleType,
      vehicleModel || null,
      vehicleYear || null,
      capacity || null,
      driverName || null,
      driverPhone || null,
      driverLicense || null,
      vehicleReg || null,
      status,
      driverId || null,
      product || null,
      description || null,
      type || null,
      color || null,
      imageUrl || null,
      notes || null
    ])
    
    truckIds.push(result.insertId)
  }
  
  return truckIds.length === 1 ? truckIds[0] : truckIds
}

/**
 * Get truck by ID
 */
export const getTruckById = async (truckId) => {
  const query = `
    SELECT t.*, 
           u.fullName as fleetManagerName, 
           u.email as fleetManagerEmail,
           d.driverName,
           d.phoneNumber as driverPhoneNumber,
           d.driverLicense as driverLicenseNumber
    FROM trucks t
    LEFT JOIN users u ON t.fleetManagerId = u.id
    LEFT JOIN drivers d ON t.driverId = d.id
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
    SELECT t.*,
           d.driverName,
           d.phoneNumber as driverPhoneNumber,
           d.driverLicense as driverLicenseNumber
    FROM trucks t
    LEFT JOIN drivers d ON t.driverId = d.id
    WHERE t.fleetManagerId = ? 
    ORDER BY t.createdAt DESC 
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
    status,
    driverId,
    product,
    description,
    type,
    color,
    imageUrl,
    notes
  } = truckData

  const query = `
    UPDATE trucks 
    SET plateNumber = ?, vehicleType = ?, vehicleModel = ?, vehicleYear = ?, 
        capacity = ?, driverName = ?, driverPhone = ?, driverLicense = ?, 
        vehicleReg = ?, status = ?, driverId = ?,
        product = ?, description = ?, type = ?, color = ?, imageUrl = ?, notes = ?,
        updatedAt = NOW()
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
    driverId !== undefined ? driverId : null,
    product !== undefined ? product : null,
    description !== undefined ? description : null,
    type !== undefined ? type : null,
    color !== undefined ? color : null,
    imageUrl !== undefined ? imageUrl : null,
    notes !== undefined ? notes : null,
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
 * Get all trucks assigned to a driver
 */
export const getTrucksByDriverId = async (driverId) => {
  const query = `
    SELECT t.*,
           u.fullName as fleetManagerName,
           u.email as fleetManagerEmail,
           u.phone as fleetManagerPhone
    FROM trucks t
    LEFT JOIN users u ON t.fleetManagerId = u.id
    WHERE t.driverId = ? 
    ORDER BY t.createdAt DESC
  `
  const [rows] = await pool.execute(query, [driverId])
  return rows
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

