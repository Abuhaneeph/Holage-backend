import pool from "../config/db.js"
import bcrypt from "bcryptjs"

/**
 * Create a new driver
 */
export const createDriver = async (driverData) => {
  const {
    fleetManagerId,
    driverName,
    phoneNumber,
    driverLicense,
    password
  } = driverData

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  const query = `
    INSERT INTO drivers 
    (fleetManagerId, driverName, phoneNumber, driverLicense, password, isActive, createdAt)
    VALUES (?, ?, ?, ?, ?, TRUE, NOW())
  `
  
  const [result] = await pool.execute(query, [
    fleetManagerId,
    driverName,
    phoneNumber,
    driverLicense,
    hashedPassword
  ])
  
  return result.insertId
}

/**
 * Get driver by ID
 */
export const getDriverById = async (driverId) => {
  const query = `
    SELECT d.*, u.fullName as fleetManagerName, u.email as fleetManagerEmail, u.phone as fleetManagerPhone
    FROM drivers d
    LEFT JOIN users u ON d.fleetManagerId = u.id
    WHERE d.id = ?
  `
  const [rows] = await pool.execute(query, [driverId])
  return rows[0]
}

/**
 * Get driver by phone number
 */
export const getDriverByPhone = async (phoneNumber) => {
  const query = `
    SELECT d.*, u.fullName as fleetManagerName, u.email as fleetManagerEmail, u.phone as fleetManagerPhone
    FROM drivers d
    LEFT JOIN users u ON d.fleetManagerId = u.id
    WHERE d.phoneNumber = ?
  `
  const [rows] = await pool.execute(query, [phoneNumber])
  return rows[0]
}

/**
 * Get all drivers by fleet manager ID
 */
export const getDriversByFleetManagerId = async (fleetManagerId) => {
  const query = `
    SELECT d.*, 
           COUNT(t.id) as assignedTrucksCount
    FROM drivers d
    LEFT JOIN trucks t ON d.id = t.driverId
    WHERE d.fleetManagerId = ?
    GROUP BY d.id
    ORDER BY d.createdAt DESC
  `
  const [rows] = await pool.execute(query, [fleetManagerId])
  return rows
}

/**
 * Update driver
 */
export const updateDriver = async (driverId, fleetManagerId, driverData) => {
  const {
    driverName,
    phoneNumber,
    driverLicense,
    password,
    isActive
  } = driverData

  let query = `
    UPDATE drivers 
    SET driverName = ?, phoneNumber = ?, driverLicense = ?, isActive = ?, updatedAt = NOW()
  `
  const params = [driverName, phoneNumber, driverLicense, isActive !== undefined ? isActive : true]

  // Only update password if provided
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10)
    query = query.replace('updatedAt = NOW()', 'password = ?, updatedAt = NOW()')
    params.splice(3, 0, hashedPassword)
  }

  query += ` WHERE id = ? AND fleetManagerId = ?`
  params.push(driverId, fleetManagerId)

  const [result] = await pool.execute(query, params)
  return result.affectedRows > 0
}

/**
 * Delete driver
 */
export const deleteDriver = async (driverId, fleetManagerId) => {
  const query = `
    DELETE FROM drivers
    WHERE id = ? AND fleetManagerId = ?
  `
  const [result] = await pool.execute(query, [driverId, fleetManagerId])
  return result.affectedRows > 0
}

/**
 * Check if phone number already exists
 */
export const checkPhoneNumberExists = async (phoneNumber, excludeDriverId = null) => {
  let query = `
    SELECT id FROM drivers 
    WHERE phoneNumber = ?
  `
  const params = [phoneNumber]
  
  if (excludeDriverId) {
    query += ` AND id != ?`
    params.push(excludeDriverId)
  }
  
  const [rows] = await pool.execute(query, params)
  return rows.length > 0
}

/**
 * Verify driver password
 */
export const verifyDriverPassword = async (phoneNumber, password) => {
  const driver = await getDriverByPhone(phoneNumber)
  if (!driver) {
    return null
  }

  const isMatch = await bcrypt.compare(password, driver.password)
  if (!isMatch) {
    return null
  }

  return driver
}

