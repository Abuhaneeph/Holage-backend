import pool from "../config/db.js"
import bcrypt from "bcryptjs"

// Updated createUser to include verificationToken and expiration
export const createUser = async (fullName, email, password, role, verificationToken, codeExpiration) => {
  const hashedPassword = await bcrypt.hash(password, 10)
  const [result] = await pool.execute(
    "INSERT INTO users (fullName, email, password, role, verificationToken) VALUES (?, ?, ?, ?, ?)",
    [fullName, email, hashedPassword, role, verificationToken],
  )
  return result.insertId
}

export const findUserByEmail = async (email) => {
  const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email])
  return rows[0]
}

export const findUserById = async (id) => {
  const [rows] = await pool.execute("SELECT * FROM users WHERE id = ?", [id])
  return rows[0]
}

export const findUserByVerificationCode = async (token) => {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE verificationToken = ? ", 
    [token]
  )
  return rows[0]
}

export const verifyUser = async (id) => {
  await pool.execute(
    "UPDATE users SET isVerified = ?, verificationToken = NULL  WHERE id = ?", 
    [true, id]
  )
}

// Updated to store reset code (6-digit) and expiration
export const updatePasswordResetToken = async (email, token, expires) => {
  await pool.execute(
    "UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?", 
    [token, expires, email]
  )
}

// Find user by reset token (for the final password reset step)
export const findUserByResetToken = async (token) => {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE resetPasswordToken = ? ",
    [token],
  )
  return rows[0]
}

// New function: Find user by reset code (6-digit code verification step)
export const findUserByResetCode = async (email, resetCode) => {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE email = ? AND resetPasswordToken = ? AND resetPasswordExpires > NOW()",
    [email, resetCode]
  )
  return rows[0]
}

// Updated to clear both reset fields
export const updatePassword = async (id, hashedPassword) => {
  await pool.execute(
    "UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?",
    [hashedPassword, id],
  )
}

export const updateKycInfo = async (userId, kycData) => {
  const {
    phone,
    address,
    nin,
    profilePhoto,
    driverLicense,
    vehicleReg,
    plateNumber,
    vehicleType,
    utilityBill,
    passportPhoto,
    kycStatus,
  } = kycData

  const query = `
    UPDATE users SET
      phone = ?,
      address = ?,
      nin = ?,
      profilePhoto = ?,
      driverLicense = ?,
      vehicleReg = ?,
      plateNumber = ?,
      vehicleType = ?,
      utilityBill = ?,
      passportPhoto = ?,
      kycStatus = ?
    WHERE id = ?
  `
  await pool.execute(query, [
    phone,
    address,
    nin,
    profilePhoto,
    driverLicense,
    vehicleReg,
    plateNumber,
    vehicleType,
    utilityBill,
    passportPhoto,
    kycStatus,
    userId,
  ])
}