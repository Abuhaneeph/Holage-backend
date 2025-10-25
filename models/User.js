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
      kycStatus = ?
    WHERE id = ?
  `
  await pool.execute(query, [
    phone || null,
    address || null,
    nin || null,
    profilePhoto || null,
    driverLicense || null,
    vehicleReg || null,
    plateNumber || null,
    vehicleType || null,
    utilityBill || null,
    kycStatus || null,
    userId,
  ])
}

// Wallet-related functions

export const updateUserWallet = async (userId, walletData) => {
  const {
    paystackCustomerCode,
    paystackCustomerId,
    walletAccountNumber,
    walletAccountName,
    walletBankName,
    walletBankSlug,
    walletBankId,
    walletActive,
    walletCurrency,
    dedicatedAccountId,
  } = walletData

  const query = `
    UPDATE users SET
      paystackCustomerCode = ?,
      paystackCustomerId = ?,
      walletAccountNumber = ?,
      walletAccountName = ?,
      walletBankName = ?,
      walletBankSlug = ?,
      walletBankId = ?,
      walletActive = ?,
      walletCurrency = ?,
      dedicatedAccountId = ?
    WHERE id = ?
  `
  await pool.execute(query, [
    paystackCustomerCode,
    paystackCustomerId,
    walletAccountNumber,
    walletAccountName,
    walletBankName,
    walletBankSlug,
    walletBankId,
    walletActive,
    walletCurrency,
    dedicatedAccountId,
    userId,
  ])
}

export const createWalletTransaction = async (userId, transactionData) => {
  const { reference, amount, currency, type, status, description, paystackReference, metadata } =
    transactionData

  const query = `
    INSERT INTO wallet_transactions 
    (userId, reference, amount, currency, type, status, description, paystackReference, metadata, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `
  const [result] = await pool.execute(query, [
    userId,
    reference,
    amount,
    currency,
    type,
    status,
    description,
    paystackReference,
    metadata,
  ])
  return result.insertId
}

export const getWalletTransactions = async (userId, limit = 20, offset = 0) => {
  const query = `
    SELECT * FROM wallet_transactions 
    WHERE userId = ? 
    ORDER BY createdAt DESC 
    LIMIT ? OFFSET ?
  `
  const [rows] = await pool.execute(query, [userId, limit, offset])
  return rows
}

export const getWalletBalance = async (userId) => {
  const query = `
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'credit' AND status = 'success' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'debit' AND status = 'success' THEN amount ELSE 0 END), 0) AS balance
    FROM wallet_transactions
    WHERE userId = ?
  `
  const [rows] = await pool.execute(query, [userId])
  return rows[0]?.balance || 0
}