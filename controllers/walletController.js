import axios from "axios"
import dotenv from "dotenv"
import pool from "../config/db.js"
import {
  findUserById,
  updateUserWallet,
  createWalletTransaction,
  getWalletTransactions,
  getWalletBalance,
  updateUserBankAccount,
} from "../models/User.js"

dotenv.config()

// KoraPay config
const KORAPAY_BASE_URL = process.env.KORAPAY_BASE_URL || "https://api.korapay.com/merchant/api/v1"
const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY
const KORAPAY_PUBLIC_KEY = process.env.KORAPAY_PUBLIC_KEY
const KORAPAY_BANK_CODE = process.env.KORAPAY_BANK_CODE || "000"

// Paystack config
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY
const PAYSTACK_BASE_URL = "https://api.paystack.co"

// Paystack API request helper
const paystackRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${PAYSTACK_BASE_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }

    if (data) {
      config.data = data
    }

    const response = await axios(config)
    return response.data
  } catch (error) {
    const status = error.response?.status
    const body = error.response?.data
    console.error("❌ Paystack API Error:")
    console.error("Status:", status)
    console.error("Response:", JSON.stringify(body, null, 2))
    throw new Error(body?.message || "Paystack API request failed")
  }
}

const korapayRequest = async (method, endpoint, data = null, params = null) => {
  try {
    const config = {
      method,
      url: `${KORAPAY_BASE_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      ...(params ? { params } : {}),
    }

    if (data) {
      config.data = data
    }

    const response = await axios(config)
    return response.data
  } catch (error) {
    const status = error.response?.status
    const body = error.response?.data
    console.error("❌ KoraPay API Error:")
    console.error("Status:", status)
    console.error("Response:", JSON.stringify(body, null, 2))
    throw new Error(body?.message || "KoraPay API request failed")
  }
}

/**
 * Helper: Create KoraPay VBA for a user and persist to DB
 */
export const createKorapayWalletForUser = async (userId) => {
  const user = await findUserById(userId)
  if (!user) throw new Error("User not found")

  const trimmedBvn = user.bvn ? String(user.bvn).trim() : ""
  if (!trimmedBvn) {
    return { skipped: true, reason: "BVN missing" }
  }

  const account_reference = `holage-${userId}-${Date.now()}`
  const body = {
    account_name: user.fullName,
    account_reference: `${account_reference}-${userId}`,
    permanent: true,
    bank_code: KORAPAY_BANK_CODE,
    customer: {
      name: user.fullName,
      email: user.email,
    },
    bvn: trimmedBvn,
  }

  const data = await korapayRequest("POST", "/virtual-bank-account", body)
  const account = data?.data || data

  if (account?.account_number) {
    await updateUserWallet(userId, {
      walletAccountNumber: account.account_number,
      walletAccountName: account.account_name,
      walletBankName: account.bank?.name || "KoraPay",
      walletBankSlug: account.bank?.slug || "korapay",
      walletBankId: account.bank?.id || null,
      walletActive: true,
      walletCurrency: "NGN",
      dedicatedAccountId: account.account_reference,
    })
  }

  return { success: true, account }
}

/**
 * Get wallet information
 */
export const getWallet = async (req, res) => {
  try {
    const userId = req.user.id

    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Get wallet balance (calculated from transactions)
    const balance = await getWalletBalance(userId)

    // Return wallet info - virtual account details are optional now (using Paystack directly)
    return res.status(200).json({
      wallet: {
        balance: balance,
        accountNumber: user.walletAccountNumber || null,
        accountName: user.walletAccountName || null,
        bankName: user.walletBankName || null,
      },
    })
  } catch (error) {
    console.error("Get wallet error:", error)
    return res.status(500).json({
      message: "Server error fetching wallet",
      error: error.message,
    })
  }
}

/**
 * Get wallet transaction history
 */
export const getTransactionHistory = async (req, res) => {
  const userId = req.user.id
  const { page = 1, limit = 20 } = req.query

  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Removed walletAccountNumber check - wallet transactions exist independently
    // Users can have transactions even without a virtual account number

    const pageNum = Number(page) || 1
    const limitNum = Number(limit) || 20
    const offsetNum = Math.max(0, (pageNum - 1) * limitNum)

    const transactions = await getWalletTransactions(userId, limitNum, offsetNum)

    return res.status(200).json({
      message: "Transaction history fetched successfully",
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
      },
    })
  } catch (error) {
    console.error("Get transaction history error:", error)
    return res.status(500).json({
      message: "Server error fetching transaction history",
      error: error.message,
    })
  }
}

// KoraPay functions (stubs - implement as needed)
export const korapayCreateVBA = async (req, res) => {
  try {
    const userId = req.user.id
    const result = await createKorapayWalletForUser(userId)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const korapayGetVBA = async (req, res) => {
  try {
    const { accountReference } = req.params
    const data = await korapayRequest("GET", `/virtual-bank-account/${accountReference}`)
    return res.json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const korapayWebhook = async (req, res) => {
  try {
    const { event, data } = req.body || {}
    if (!event || !data) return res.status(400).json({ message: "Invalid webhook payload" })

    if (event === "charge.success") {
      const reference = data.reference || data.payment_reference
      if (!reference) return res.status(200).json({ message: "No reference to verify" })

      // Extract userId from reference or lookup pending transaction
      let userIdFromRef = null
      if (reference && reference.startsWith("HOLAGE-") && reference.includes("-")) {
        const parts = reference.split("-")
        if (parts.length >= 3) {
          const last = parts[parts.length - 1]
          if (/^\d+$/.test(last)) userIdFromRef = parseInt(last, 10)
        }
      }

      if (!userIdFromRef) {
        try {
          const [rows] = await pool.query(
            `SELECT userId FROM wallet_transactions WHERE reference = ? AND status = 'pending' LIMIT 1`,
            [reference]
          )
          if (rows && rows.length > 0) {
            userIdFromRef = rows[0].userId
          }
        } catch (e) {
          console.error("Error looking up reference:", e.message)
        }
      }

      if (userIdFromRef) {
        try {
          const amount = Number(data.amount || data.amount_paid || 0) / 100
          const currency = data.currency || "NGN"
          await createWalletTransaction(userIdFromRef, {
            reference,
            amount,
            currency,
            type: "credit",
            status: "success",
            description: "Wallet funding via KoraPay",
            paystackReference: reference,
            metadata: JSON.stringify({ webhook: req.body, verified: charge, source: "checkout_standard" }),
          })
          console.log(`✅ Wallet credited for user ${userIdFromRef}: ${amount} ${currency} (ref: ${reference})`)
        } catch (e) {
          if (e?.code === 'ER_DUP_ENTRY') {
            console.log(`⚠️ Duplicate transaction for reference ${reference}, skipping`)
          } else {
            throw e
          }
        }
      }
    }

    return res.status(200).json({ message: "received" })
  } catch (error) {
    console.error("KoraPay webhook error:", error)
    return res.status(500).json({ message: "Webhook processing failed" })
  }
}

export const korapayGetCharge = async (req, res) => {
  try {
    const { reference } = req.params
    const data = await korapayRequest("GET", `/charges/${encodeURIComponent(reference)}`)
    return res.json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const korapayListVBATransactions = async (req, res) => {
  try {
    const { account_number, start_date, end_date, page, limit } = req.query
    if (!account_number) {
      return res.status(400).json({ message: "account_number is required" })
    }

    const params = { account_number, ...(start_date ? { start_date } : {}), ...(end_date ? { end_date } : {}), ...(page ? { page } : {}), ...(limit ? { limit } : {}) }
    const data = await korapayRequest("GET", "/virtual-bank-account/transactions", null, params)
    return res.json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const korapaySandboxCredit = async (req, res) => {
  try {
    const userId = req.user.id
    const { amount, currency = "NGN" } = req.body || {}
    if (!amount) {
      return res.status(400).json({ message: "amount is required" })
    }

    const reference = `SANDBOX-${Date.now()}-${userId}`
    await createWalletTransaction(userId, {
      reference,
      amount: Number(amount),
      currency,
      type: "credit",
      status: "success",
      description: "Sandbox credit",
      paystackReference: reference,
      metadata: JSON.stringify({ source: "sandbox" }),
    })

    const balance = await getWalletBalance(userId)
    return res.json({ message: "Sandbox credit successful", balance })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const korapayInitiateBankTransfer = async (req, res) => {
  try {
    const userId = req.user?.id
    const { account_name, amount, currency = "NGN", reference, customer } = req.body || {}
    if (!account_name || !amount || !reference || !customer?.name || !customer?.email) {
      return res.status(400).json({ message: "account_name, amount, currency, reference, customer{name,email} are required" })
    }
    const payload = { account_name, amount, currency, reference, customer }
    const data = await korapayRequest("POST", "/charges/bank-transfer", payload)

    // Try immediate verification; if already successful, credit wallet now
    try {
      const verify = await korapayRequest("GET", `/charges/${encodeURIComponent(reference)}`)
      const charge = verify?.data || verify?.data?.data || {}
      if (charge?.status === "success" && userId) {
        const amountPaid = Number(charge?.amount_paid || charge?.amount || 0)
        const creditedCurrency = charge?.currency || currency
        await createWalletTransaction(userId, {
          reference,
          amount: amountPaid,
          currency: creditedCurrency,
          type: "credit",
          status: "success",
          description: "Wallet funding via KoraPay bank transfer",
          paystackReference: reference,
          metadata: JSON.stringify({ initiate: data, verified: verify }),
        })
        const balance = await getWalletBalance(userId)
        return res.status(201).json({ message: "Bank transfer initiated and wallet credited", charge: verify, balance })
      }
    } catch (e) {
      // Ignore verification errors here; client can confirm later
    }

    return res.status(201).json({ message: "Bank transfer initiated", data })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const korapayConfirmChargeAndCredit = async (req, res) => {
  try {
    const userId = req.user?.id
    const { reference } = req.params
    if (!userId) return res.status(401).json({ message: "Unauthorized" })
    if (!reference) return res.status(400).json({ message: "reference is required" })

    const chargeResp = await korapayRequest("GET", `/charges/${encodeURIComponent(reference)}`)
    const charge = chargeResp?.data || chargeResp?.data?.data || {}
    const status = charge?.status

    // Return non-error for non-final states so clients can poll without showing failure
    if (status !== "success") {
      const httpCode = status === "failed" || status === "expired" ? 400 : 202
      return res.status(httpCode).json({ message: status || "pending", charge: chargeResp })
    }

    const amountPaid = Number(charge?.amount_paid || charge?.amount || 0)
    const currency = charge?.currency || "NGN"

    // Record credit transaction for the authenticated user
    try {
      await createWalletTransaction(userId, {
        reference,
        amount: amountPaid,
        currency,
        type: "credit",
        status: "success",
        description: "Wallet funding via KoraPay bank transfer",
        paystackReference: reference,
        metadata: JSON.stringify({ verified: chargeResp }),
      })
    } catch (e) {
      // If duplicate reference (unique), treat as idempotent success
      if (e?.code !== 'ER_DUP_ENTRY') throw e
    }

    const balance = await getWalletBalance(userId)
    return res.json({ message: "Wallet credited", balance, amount: amountPaid, currency })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const korapayInitiateCheckout = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ message: "Unauthorized" })

    const { amount, currency = "NGN" } = req.body || {}
    if (!amount || amount < 100) {
      return res.status(400).json({ message: "Amount is required and must be at least 100" })
    }

    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (!user.email || !user.email.includes('@')) {
      return res.status(400).json({ message: "Valid email address is required. Please update your profile." })
    }

    const timestamp = Date.now()
    const reference = `KPY-${timestamp}-${userId}`.substring(0, 100)

    // Store reference mapping in database (for webhook lookup)
    try {
      await pool.query(
        `INSERT INTO wallet_transactions (userId, reference, amount, currency, type, status, description, createdAt)
         VALUES (?, ?, ?, ?, 'credit', 'pending', 'Wallet funding via Kora Checkout Standard', NOW())
         ON DUPLICATE KEY UPDATE reference = reference`,
        [userId, reference, amount, currency]
      )
    } catch (e) {
      if (e?.code !== 'ER_DUP_ENTRY') {
        console.error("Error storing reference:", e.message)
      }
    }

    const baseUrl = process.env.VITE_API_URL 
      ? process.env.VITE_API_URL.replace('/api', '')
      : (process.env.API_BASE_URL || process.env.BASE_URL || "http://localhost:4000")
    const notificationUrl = `${baseUrl}/api/wallet/korapay/webhook`

    // Ensure amount is an integer (Kora requires integer amounts)
    const amountInt = Math.round(Number(amount))

    const checkoutData = {
      key: KORAPAY_PUBLIC_KEY,
      reference,
      amount: amountInt,
      currency,
      customer: {
        name: user.fullName || "User",
        email: user.email.trim(),
      },
      notification_url: notificationUrl,
    }

    return res.json({
      success: true,
      ...checkoutData,
    })
  } catch (error) {
    console.error("Error initiating Kora Checkout:", error)
    return res.status(500).json({ message: error.message || "Failed to initiate checkout" })
  }
}

/**
 * Initialize Paystack payment
 */
export const paystackInitiatePayment = async (req, res) => {
  try {
    const userId = req.user?.id
    const { amount, currency = "NGN" } = req.body || {}

    if (!amount || amount < 100) {
      return res.status(400).json({ message: "Amount is required and must be at least 100" })
    }

    if (!PAYSTACK_SECRET_KEY || !PAYSTACK_PUBLIC_KEY) {
      return res.status(500).json({ message: "Paystack public key not configured" })
    }

    // Get user details
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Validate customer email (required by Paystack)
    if (!user.email || !user.email.includes('@')) {
      return res.status(400).json({ message: "Valid email address is required. Please update your profile." })
    }

    // Generate unique reference
    const timestamp = Date.now()
    const reference = `HOLAGE-${timestamp}-${userId}`.substring(0, 100)

    // Store reference mapping in database (for webhook lookup)
    try {
      await pool.query(
        `INSERT INTO wallet_transactions (userId, reference, amount, currency, type, status, description, createdAt)
         VALUES (?, ?, ?, ?, 'credit', 'pending', 'Wallet funding via Paystack', NOW())
         ON DUPLICATE KEY UPDATE reference = reference`,
        [userId, reference, amount, currency]
      )
    } catch (e) {
      if (e?.code !== 'ER_DUP_ENTRY') {
        console.error("Error storing reference:", e.message)
      }
    }

    // Construct callback URL
    const baseUrl = process.env.VITE_API_URL 
      ? process.env.VITE_API_URL.replace('/api', '')
      : (process.env.API_BASE_URL || process.env.BASE_URL || "http://localhost:4000")
    const callbackUrl = `${baseUrl}/api/wallet/paystack/callback`

    const paymentData = {
      success: true,
      publicKey: PAYSTACK_PUBLIC_KEY,
      reference,
      amount: Math.round(Number(amount)) * 100, // Paystack uses amount in kobo (smallest currency unit)
      currency,
      email: user.email.trim(),
      name: (user.fullName || "User").trim(),
      callbackUrl
    }

    console.log('Paystack payment initiated:', {
      reference,
      amount: paymentData.amount,
      currency,
      email: user.email,
      callbackUrl
    })

    return res.json(paymentData)
  } catch (error) {
    console.error("Error initiating Paystack payment:", error)
    return res.status(500).json({ message: error.message || "Failed to initiate payment" })
  }
}

/**
 * Paystack webhook handler
 */
export const paystackWebhook = async (req, res) => {
  try {
    const { event, data } = req.body || {}
    
    if (event === "charge.success") {
      const reference = data.reference
      const amount = data.amount / 100 // Convert from kobo to NGN
      const currency = data.currency || "NGN"
      const customerEmail = data.customer?.email

      if (!reference) {
        return res.status(200).json({ message: "No reference" })
      }

      // Extract userId from reference (format: HOLAGE-<timestamp>-<userId>)
      let userIdFromRef = null
      if (reference && reference.startsWith("HOLAGE-") && reference.includes("-")) {
        const parts = reference.split("-")
        if (parts.length >= 3) {
          const last = parts[parts.length - 1]
          if (/^\d+$/.test(last)) userIdFromRef = parseInt(last, 10)
        }
      }

      // If not found in reference, try to find from pending transaction
      if (!userIdFromRef) {
        try {
          const [rows] = await pool.query(
            `SELECT userId FROM wallet_transactions WHERE reference = ? AND status = 'pending' LIMIT 1`,
            [reference]
          )
          if (rows && rows.length > 0) {
            userIdFromRef = rows[0].userId
          }
        } catch (e) {
          console.error("Error looking up reference:", e.message)
        }
      }

      if (userIdFromRef) {
        try {
          await createWalletTransaction(userIdFromRef, {
            reference,
            amount,
            currency,
            type: "credit",
            status: "success",
            description: "Wallet funding via Paystack",
            paystackReference: reference,
            metadata: JSON.stringify({ webhook: req.body, source: "paystack" }),
          })
          console.log(`✅ Wallet credited for user ${userIdFromRef}: ${amount} ${currency} (ref: ${reference})`)
        } catch (e) {
          if (e?.code === 'ER_DUP_ENTRY') {
            console.log(`⚠️ Duplicate transaction for reference ${reference}, skipping`)
          } else {
            console.error("Failed to record wallet transaction:", e.message)
          }
        }
      } else {
        console.warn(`⚠️ Could not determine userId for reference: ${reference}`)
      }
    }

    return res.status(200).json({ message: "received" })
  } catch (error) {
    console.error("Paystack webhook error:", error)
    return res.status(500).json({ message: "Webhook processing failed" })
  }
}

/**
 * Verify Paystack payment and credit wallet
 * Query params: reference (required)
 */
export const verifyPaystackPayment = async (req, res) => {
  try {
    const { reference } = req.query || {}
    const userId = req.user?.id

    console.log(`🔍 Verifying Paystack payment - Reference: ${reference}, UserId: ${userId}`)

    if (!userId) {
      console.error('❌ Verification failed: No userId')
      return res.status(401).json({ message: "Unauthorized" })
    }

    if (!reference) {
      console.error('❌ Verification failed: No reference provided')
      return res.status(400).json({ message: "Payment reference is required" })
    }

    if (!PAYSTACK_SECRET_KEY) {
      console.error('❌ Verification failed: Paystack secret key not configured')
      return res.status(500).json({ message: "Paystack secret key not configured" })
    }

    // Verify payment with Paystack
    console.log(`📞 Calling Paystack API to verify transaction: ${reference}`)
    const verification = await paystackRequest("GET", `/transaction/verify/${reference}`)
    console.log(`📥 Paystack verification response:`, {
      status: verification.status,
      hasData: !!verification.data,
      transactionStatus: verification.data?.status
    })

    if (!verification.status || !verification.data) {
      console.error('❌ Verification failed: Invalid response from Paystack', verification)
      return res.status(400).json({ 
        message: "Payment verification failed", 
        error: verification.message || "Invalid payment reference" 
      })
    }

    const paymentData = verification.data
    const amount = paymentData.amount / 100 // Convert from kobo to NGN
    const currency = paymentData.currency || "NGN"
    const paymentStatus = paymentData.status

    console.log(`💰 Payment details: Amount: ${amount} ${currency}, Status: ${paymentStatus}`)

    // Check if payment was successful
    if (paymentStatus !== "success") {
      console.warn(`⚠️ Payment not successful. Status: ${paymentStatus}, Reference: ${reference}`)
      return res.status(400).json({ 
        message: `Payment not successful. Status: ${paymentStatus}`,
        status: paymentStatus
      })
    }

    // Check if transaction already exists
    try {
      const [existing] = await pool.query(
        `SELECT id FROM wallet_transactions WHERE reference = ? AND status = 'success' LIMIT 1`,
        [reference]
      )

      if (existing && existing.length > 0) {
        // Transaction already processed, just return current balance
        console.log(`ℹ️ Transaction ${reference} already processed, returning current balance`)
        const balance = await getWalletBalance(userId)
        return res.json({
          success: true,
          message: "Payment already processed",
          balance,
          transaction: { reference, amount, currency, status: "success" }
        })
      }
    } catch (checkError) {
      console.error("❌ Error checking existing transaction:", checkError)
    }

    // Credit wallet
    try {
      console.log(`💳 Creating wallet transaction for user ${userId}: ${amount} ${currency}`)
      await createWalletTransaction(userId, {
        reference,
        amount,
        currency,
        type: "credit",
        status: "success",
        description: "Wallet funding via Paystack",
        paystackReference: reference,
        metadata: JSON.stringify({ 
          verification: verification.data, 
          source: "paystack_verify",
          verifiedAt: new Date().toISOString()
        }),
      })

      const balance = await getWalletBalance(userId)

      console.log(`✅ Wallet credited via verification for user ${userId}: ${amount} ${currency} (ref: ${reference})`)
      console.log(`💰 New wallet balance: ${balance} ${currency}`)

      return res.json({
        success: true,
        message: "Payment verified and wallet credited",
        balance,
        transaction: {
          reference,
          amount,
          currency,
          status: "success"
        }
      })
    } catch (creditError) {
      console.error(`❌ Error crediting wallet:`, creditError)
      if (creditError?.code === 'ER_DUP_ENTRY') {
        // Duplicate entry, payment was already processed
        console.log(`ℹ️ Duplicate transaction detected, returning current balance`)
        const balance = await getWalletBalance(userId)
        return res.json({
          success: true,
          message: "Payment already processed",
          balance,
          transaction: { reference, amount, currency, status: "success" }
        })
      }
      throw creditError
    }
  } catch (error) {
    console.error("Error verifying Paystack payment:", error)
    return res.status(500).json({ message: error.message || "Failed to verify payment" })
  }
}

/**
 * Credit wallet directly from Paystack callback (simplified - no verification)
 * Body: reference
 */
export const creditWalletFromPaystackCallback = async (req, res) => {
  try {
    const { reference } = req.body || {}
    const userId = req.user?.id

    console.log(`💰 Crediting wallet from Paystack callback - Reference: ${reference}, UserId: ${userId}`)

    if (!userId) {
      console.error('❌ No userId')
      return res.status(401).json({ message: "Unauthorized" })
    }

    if (!reference) {
      console.error('❌ No reference provided')
      return res.status(400).json({ message: "Payment reference is required" })
    }

    // Find pending transaction for this reference
    const [pendingTx] = await pool.query(
      `SELECT userId, amount, currency, reference FROM wallet_transactions 
       WHERE reference = ? AND status = 'pending' LIMIT 1`,
      [reference]
    )

    if (!pendingTx || pendingTx.length === 0) {
      console.error(`❌ No pending transaction found for reference: ${reference}`)
      return res.status(404).json({ message: "Pending transaction not found" })
    }

    const pendingTransaction = pendingTx[0]
    
    // Verify the transaction belongs to this user
    if (pendingTransaction.userId !== userId) {
      console.error(`❌ Transaction belongs to different user`)
      return res.status(403).json({ message: "Transaction does not belong to this user" })
    }

    const amount = parseFloat(pendingTransaction.amount || 0)
    const currency = pendingTransaction.currency || "NGN"

    // Check if already processed
    const [existing] = await pool.query(
      `SELECT id FROM wallet_transactions WHERE reference = ? AND status = 'success' LIMIT 1`,
      [reference]
    )

    if (existing && existing.length > 0) {
      console.log(`ℹ️ Transaction ${reference} already processed`)
      const balance = await getWalletBalance(userId)
      return res.json({
        success: true,
        message: "Payment already processed",
        balance,
        transaction: { reference, amount, currency, status: "success" }
      })
    }

    // Credit wallet - Update existing pending transaction to success instead of creating new one
    try {
      console.log(`💳 Crediting wallet for user ${userId}: ${amount} ${currency}`)
      
      // Update the existing pending transaction to success
      await pool.query(
        `UPDATE wallet_transactions 
         SET status = 'success', 
             description = 'Wallet funding via Paystack',
             paystackReference = ?,
             metadata = ?,
             updatedAt = NOW()
         WHERE reference = ? AND status = 'pending'`,
        [
          reference,
          JSON.stringify({ 
            source: "paystack_callback",
            creditedAt: new Date().toISOString()
          }),
          reference
        ]
      )
      
      // Check if update was successful
      const [updated] = await pool.query(
        `SELECT id FROM wallet_transactions WHERE reference = ? AND status = 'success' LIMIT 1`,
        [reference]
      )
      
      if (!updated || updated.length === 0) {
        throw new Error("Failed to update transaction status")
      }
      
      console.log(`✅ Transaction updated to success for reference: ${reference}`)

      const balance = await getWalletBalance(userId)

      console.log(`✅ Wallet credited for user ${userId}: ${amount} ${currency} (ref: ${reference})`)
      console.log(`💰 New wallet balance: ${balance} ${currency}`)

      return res.json({
        success: true,
        message: "Wallet credited successfully",
        balance,
        transaction: {
          reference,
          amount,
          currency,
          status: "success"
        }
      })
    } catch (creditError) {
      console.error(`❌ Error crediting wallet:`, creditError)
      
      // If transaction was already updated (race condition), return success
      const [check] = await pool.query(
        `SELECT id FROM wallet_transactions WHERE reference = ? AND status = 'success' LIMIT 1`,
        [reference]
      )
      
      if (check && check.length > 0) {
        console.log(`ℹ️ Transaction ${reference} was already processed (race condition)`)
        const balance = await getWalletBalance(userId)
        return res.json({
          success: true,
          message: "Payment already processed",
          balance,
          transaction: { reference, amount, currency, status: "success" }
        })
      }
      
      throw creditError
    }
  } catch (error) {
    console.error("Error crediting wallet from callback:", error)
    return res.status(500).json({ message: error.message || "Failed to credit wallet" })
  }
}

/**
 * Transfer money to a bank account using Paystack Transfer API
 */
export const paystackTransferToBank = async (req, res) => {
  try {
    const { accountNumber, bankCode, bankName, amount, reason, recipientCode } = req.body || {}
    
    if (!amount || amount < 100) {
      return res.status(400).json({ message: "Amount is required and must be at least 100" })
    }

    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ message: "Paystack secret key not configured" })
    }

    // If recipientCode is provided, use it directly
    if (recipientCode) {
      const transferData = {
        source: "balance",
        amount: Math.round(Number(amount)) * 100,
        recipient: recipientCode,
        reason: reason || "Payment for shipment",
        currency: "NGN"
      }

      const result = await paystackRequest("POST", "/transfer", transferData)
      return res.json({ success: true, transfer: result })
    }

    // Otherwise, create recipient first, then transfer
    if (!accountNumber) {
      return res.status(400).json({ message: "accountNumber is required (or provide recipientCode)" })
    }

    let finalBankCode = bankCode

    // If bankCode is not provided but bankName is, fetch bank code from Paystack
    if (!finalBankCode && bankName) {
      try {
        const banksResponse = await paystackRequest("GET", "/bank?country=nigeria")
        if (banksResponse.status && banksResponse.data) {
          const bank = banksResponse.data.find(
            b => b.name.toLowerCase() === bankName.toLowerCase() || 
                 b.slug.toLowerCase() === bankName.toLowerCase()
          )
          if (bank) {
            finalBankCode = bank.code
          }
        }
      } catch (e) {
        console.error("Error fetching bank code:", e.message)
      }
    }

    if (!finalBankCode) {
      return res.status(400).json({ message: "bankCode is required (or provide bankName to auto-fetch)" })
    }

    // Create transfer recipient
    const recipientData = {
      type: "nuban",
      name: req.user?.fullName || "Recipient",
      account_number: accountNumber,
      bank_code: finalBankCode,
      currency: "NGN"
    }

    const recipientResponse = await paystackRequest("POST", "/transferrecipient", recipientData)

    if (!recipientResponse.status || !recipientResponse.data) {
      return res.status(400).json({ 
        message: "Failed to create transfer recipient",
        error: recipientResponse.message 
      })
    }

    // Perform transfer
    const transferData = {
      source: "balance",
      amount: Math.round(Number(amount)) * 100,
      recipient: recipientResponse.data.recipient_code,
      reason: reason || "Payment for shipment",
      currency: "NGN"
    }

    const transferResponse = await paystackRequest("POST", "/transfer", transferData)

    return res.json({ 
      success: true, 
      transfer: transferResponse,
      recipient: recipientResponse.data
    })
  } catch (error) {
    console.error("Error transferring to bank:", error)
    return res.status(500).json({ message: error.message || "Failed to transfer funds" })
  }
}

/**
 * Withdraw funds from wallet to bank account
 * This function debits the wallet and transfers to bank account
 */
export const withdrawToBank = async (req, res) => {
  try {
    const userId = req.user?.id
    const { amount } = req.body || {}
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    if (!amount || amount < 100) {
      return res.status(400).json({ message: "Amount is required and must be at least ₦100" })
    }

    // Get user details including bank account
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Check if user has bank account details
    if (!user.bankAccountNumber || !user.bankCode) {
      return res.status(400).json({ 
        message: "Bank account details required. Please update your profile with bank account information." 
      })
    }

    // Check wallet balance
    const walletBalance = await getWalletBalance(userId)
    const withdrawAmount = parseFloat(amount)
    
    if (withdrawAmount > walletBalance) {
      return res.status(400).json({ 
        message: `Insufficient balance. Your wallet balance is ₦${walletBalance.toLocaleString('en-NG')}` 
      })
    }

    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ message: "Paystack secret key not configured" })
    }

    // Create debit transaction first (pending status)
    const timestamp = Date.now()
    const debitReference = `WITHDRAW-${timestamp}-${userId}`
    
    await createWalletTransaction(userId, {
      reference: debitReference,
      amount: withdrawAmount,
      currency: "NGN",
      type: "debit",
      status: "pending",
      description: `Withdrawal to bank account: ${user.bankAccountNumber}`,
      paystackReference: null,
      metadata: JSON.stringify({ 
        bankAccountNumber: user.bankAccountNumber,
        bankCode: user.bankCode,
        bankName: user.bankName
      })
    })

    try {
      // Create transfer recipient
      const recipientData = {
        type: "nuban",
        name: user.fullName || "User",
        account_number: user.bankAccountNumber,
        bank_code: user.bankCode,
        currency: "NGN"
      }

      const recipientResponse = await paystackRequest("POST", "/transferrecipient", recipientData)

      if (!recipientResponse.status || !recipientResponse.data) {
        // Update transaction to failed
        await pool.execute(
          `UPDATE wallet_transactions SET status = 'failed', updatedAt = NOW() WHERE reference = ?`,
          [debitReference]
        )
        
        // Check for specific Paystack account tier error
        const errorMessage = recipientResponse.message || ""
        if (errorMessage.includes("starter business") || errorMessage.includes("third party payouts")) {
          return res.status(403).json({ 
            message: "Withdrawal feature is not available. Your Paystack account needs to be upgraded to a Registered Business to enable transfers. Please upgrade your Paystack account in the Compliance section of your Paystack Dashboard.",
            error: "Paystack account tier limitation",
            requiresUpgrade: true
          })
        }
        
        return res.status(400).json({ 
          message: "Failed to create transfer recipient",
          error: recipientResponse.message 
        })
      }

      // Perform transfer
      const transferData = {
        source: "balance",
        amount: Math.round(withdrawAmount) * 100, // Convert to kobo
        recipient: recipientResponse.data.recipient_code,
        reason: `Wallet withdrawal - ${debitReference}`,
        currency: "NGN"
      }

      const transferResponse = await paystackRequest("POST", "/transfer", transferData)

      if (transferResponse.status && transferResponse.data) {
        // Update transaction to success
        await pool.execute(
          `UPDATE wallet_transactions 
           SET status = 'success', 
               paystackReference = ?,
               metadata = JSON_MERGE_PATCH(COALESCE(metadata, '{}'), ?),
               updatedAt = NOW() 
           WHERE reference = ?`,
          [
            transferResponse.data.reference || debitReference,
            JSON.stringify({ 
              transfer: transferResponse.data,
              recipient: recipientResponse.data
            }),
            debitReference
          ]
        )

        const newBalance = await getWalletBalance(userId)

        return res.json({ 
          success: true,
          message: `Withdrawal of ₦${withdrawAmount.toLocaleString('en-NG')} successful. Funds have been transferred to your bank account.`,
          transaction: {
            reference: debitReference,
            amount: withdrawAmount,
            status: "success"
          },
          balance: newBalance,
          transfer: transferResponse.data
        })
      } else {
        // Transfer failed - update transaction to failed
        await pool.execute(
          `UPDATE wallet_transactions SET status = 'failed', updatedAt = NOW() WHERE reference = ?`,
          [debitReference]
        )
        
        // Check for specific Paystack account tier error
        const errorMessage = transferResponse.message || ""
        if (errorMessage.includes("starter business") || errorMessage.includes("third party payouts")) {
          return res.status(403).json({ 
            message: "Withdrawal feature is not available. Your Paystack account needs to be upgraded to a Registered Business to enable transfers. Please upgrade your Paystack account in the Compliance section of your Paystack Dashboard.",
            error: "Paystack account tier limitation",
            requiresUpgrade: true
          })
        }
        
        return res.status(400).json({ 
          message: "Transfer failed",
          error: transferResponse.message || "Unknown error"
        })
      }
    } catch (transferError) {
      // Update transaction to failed
      await pool.execute(
        `UPDATE wallet_transactions SET status = 'failed', updatedAt = NOW() WHERE reference = ?`,
        [debitReference]
      )
      
      console.error("Error processing withdrawal:", transferError)
      
      // Check for specific Paystack account tier error in catch block
      const errorMessage = transferError.message || transferError.response?.data?.message || ""
      if (errorMessage.includes("starter business") || errorMessage.includes("third party payouts")) {
        return res.status(403).json({ 
          message: "Withdrawal feature is not available. Your Paystack account needs to be upgraded to a Registered Business to enable transfers. Please upgrade your Paystack account in the Compliance section of your Paystack Dashboard.",
          error: "Paystack account tier limitation",
          requiresUpgrade: true
        })
      }
      
      return res.status(500).json({ 
        message: transferError.message || "Failed to process withdrawal",
        error: transferError.response?.data || transferError.message
      })
    }
  } catch (error) {
    console.error("Error withdrawing funds:", error)
    return res.status(500).json({ message: error.message || "Failed to withdraw funds" })
  }
}

/**
 * Get list of Nigerian banks from Paystack
 */
export const getPaystackBanks = async (req, res) => {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ message: "Paystack secret key not configured" })
    }

    const banksResponse = await paystackRequest("GET", "/bank?country=nigeria")
    
    if (banksResponse.status && banksResponse.data) {
      const banks = banksResponse.data.map(bank => ({
        name: bank.name,
        code: bank.code,
        slug: bank.slug,
        longcode: bank.longcode
      }))
      
      return res.json({ success: true, banks })
    } else {
      return res.status(400).json({ message: "Failed to fetch banks", error: banksResponse.message })
    }
  } catch (error) {
    console.error("Error fetching Paystack banks:", error)
    return res.status(500).json({ message: error.message || "Failed to fetch banks" })
  }
}

/**
 * Resolve bank account number to get account name
 */
export const resolveBankAccount = async (req, res) => {
  try {
    const { account_number, bank_code } = req.query

    if (!account_number || !bank_code) {
      return res.status(400).json({ 
        message: "account_number and bank_code are required" 
      })
    }

    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ message: "Paystack secret key not configured" })
    }

    const resolveResponse = await paystackRequest(
      "GET", 
      `/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`
    )
    
    if (resolveResponse.status && resolveResponse.data) {
      return res.json({
        success: true,
        account_name: resolveResponse.data.account_name,
        account_number: resolveResponse.data.account_number
      })
    } else {
      return res.status(400).json({ 
        message: resolveResponse.message || "Failed to resolve account",
        error: resolveResponse.message 
      })
    }
  } catch (error) {
    console.error("Error resolving bank account:", error)
    let errorMessage = error.response?.data?.message || error.message || "Failed to resolve account"
    let statusCode = error.response?.status || 500
    
    // Handle Paystack test mode limitations
    if (errorMessage.includes("Test mode daily limit") || errorMessage.includes("test bank codes")) {
      errorMessage = "Account verification is temporarily unavailable in test mode. Please try again later or contact support."
      statusCode = 503 // Service Unavailable
    }
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: errorMessage
    })
  }
}
