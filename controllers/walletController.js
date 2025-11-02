import axios from "axios"
import dotenv from "dotenv"
import pool from "../config/db.js"
import {
  findUserById,
  updateUserWallet,
  createWalletTransaction,
  getWalletTransactions,
  getWalletBalance,
} from "../models/User.js"

dotenv.config()

// KoraPay config
const KORAPAY_BASE_URL = process.env.KORAPAY_BASE_URL || "https://api.korapay.com/merchant/api/v1"
const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY

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

  // Require BVN (Korapay requirement). If missing, skip gracefully.
  if (!user.bvn) {
    return { skipped: true, reason: "BVN missing" }
  }

  const account_reference = `holage-${userId}-${Date.now()}`
  const body = {
    account_name: user.fullName,
    account_reference: `${account_reference}-${userId}`,
    permanent: true,
    bank_code: "000",
    customer: {
      name: user.fullName,
      email: user.email || undefined,
    },
    kyc: {
      bvn: String(user.bvn),
      ...(user.nin ? { nin: String(user.nin) } : {}),
    },
  }

  const resp = await korapayRequest("POST", "/virtual-bank-account", body)
  const acc = resp?.data || resp?.data?.data || resp

  // Persist to users table using existing wallet fields
  await updateUserWallet(userId, {
    paystackCustomerCode: null,
    paystackCustomerId: null,
    walletAccountNumber: acc?.account_number,
    walletAccountName: acc?.account_name || user.fullName,
    walletBankName: acc?.bank_name || "KoraPay",
    walletBankSlug: (acc?.bank_name || "korapay").toLowerCase().replace(/\s+/g, "-"),
    walletBankId: null,
    walletActive: acc?.account_status === "active" || true,
    walletCurrency: acc?.currency || "NGN",
    dedicatedAccountId: acc?.unique_id || null,
  })

  return { created: true, account: acc }
}

const FLUTTERWAVE_CLIENT_ID = process.env.FLUTTERWAVE_PUBLIC_KEY // Client ID
const FLUTTERWAVE_CLIENT_SECRET = process.env.FLUTTERWAVE_SECRET_KEY // Client Secret
const FLUTTERWAVE_BASE_URL = process.env.FLUTTERWAVE_BASE_URL || "https://developersandbox-api.flutterwave.com"
const OAUTH_TOKEN_URL = "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token"

// Token cache
let accessToken = null
let tokenExpiresAt = 0

/**
 * Get or refresh OAuth 2.0 access token
 */
const getAccessToken = async () => {
  const now = Date.now()
  
  // Return cached token if still valid (refresh 1 minute before expiry)
  if (accessToken && tokenExpiresAt > now + 60000) {
    return accessToken
  }

  try {
    console.log("🔄 Refreshing Flutterwave OAuth token...")
    
    const params = new URLSearchParams()
    params.append("client_id", FLUTTERWAVE_CLIENT_ID)
    params.append("client_secret", FLUTTERWAVE_CLIENT_SECRET)
    params.append("grant_type", "client_credentials")

    const response = await axios.post(OAUTH_TOKEN_URL, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    accessToken = response.data.access_token
    const expiresIn = response.data.expires_in || 600 // Default 10 minutes
    tokenExpiresAt = now + expiresIn * 1000

    console.log("✅ OAuth token refreshed successfully")
    console.log(`   Token expires in: ${expiresIn} seconds`)
    
    return accessToken
  } catch (error) {
    console.error("❌ OAuth token refresh failed:", error.response?.data || error.message)
    throw new Error("Failed to obtain Flutterwave access token")
  }
}

/**
 * Helper function to make authenticated Flutterwave API calls
 */
const flutterwaveRequest = async (method, endpoint, data = null) => {
  try {
    // Get valid access token
    const token = await getAccessToken()

    const config = {
      method,
      url: `${FLUTTERWAVE_BASE_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }

    if (data) {
      config.data = data
    }

    const response = await axios(config)
    return response.data
  } catch (error) {
    console.error("❌ Flutterwave API Error:")
    console.error("Status:", error.response?.status)
    console.error("Full Response:", JSON.stringify(error.response?.data, null, 2))
    
    // Log validation errors in detail
    if (error.response?.data?.error?.validation_errors) {
      console.error("\n📋 Validation Errors Detail:")
      error.response.data.error.validation_errors.forEach((err, index) => {
        console.error(`  ${index + 1}.`, JSON.stringify(err, null, 2))
      })
    }
    
    // If token expired, clear cache and retry once
    if (error.response?.status === 401 && accessToken) {
      console.log("🔄 Token might be expired, retrying with fresh token...")
      accessToken = null
      tokenExpiresAt = 0
      
      // Retry once with fresh token
      const token = await getAccessToken()
      const config = {
        method,
        url: `${FLUTTERWAVE_BASE_URL}${endpoint}`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
      if (data) config.data = data
      
      try {
        const response = await axios(config)
        return response.data
      } catch (retryError) {
        console.error("Retry failed:", retryError.response?.data || retryError.message)
        throw new Error(retryError.response?.data?.message || "Flutterwave API request failed")
      }
    }
    
    throw new Error(error.response?.data?.message || "Flutterwave API request failed")
  }
}

// Removed Flutterwave-specific wallet creation and helpers

/**
 * Get user's wallet details
 */
export const getWallet = async (req, res) => {
  const userId = req.user.id

  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (!user.walletAccountNumber) {
      return res.status(404).json({ message: "No wallet found for this user" })
    }

    // Get wallet balance
    const balance = await getWalletBalance(userId)

    return res.status(200).json({
      wallet: {
        accountNumber: user.walletAccountNumber,
        accountName: user.walletAccountName,
        bankName: user.walletBankName,
        currency: user.walletCurrency || "NGN",
        active: user.walletActive,
        balance: balance || 0,
      },
    })
  } catch (error) {
    console.error("Get wallet error:", error)
    return res.status(500).json({
      message: "Server error fetching wallet details",
      error: error.message,
    })
  }
}

/**
 * Fetch available currencies for virtual accounts
 */
// Removed Flutterwave available banks

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

    if (!user.walletAccountNumber) {
      return res.status(404).json({ message: "No wallet found for this user" })
    }

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

/**
 * Webhook handler for Flutterwave events
 * This endpoint receives notifications when funds are transferred to the virtual account
 */
// Removed Flutterwave webhook

/**
 * Get all virtual accounts for a user (if multiple accounts exist)
 */
// Removed Flutterwave list virtual accounts

// Removed Flutterwave get virtual account by ID

/**
 * Create a new virtual account with extended expiry
 * Note: Flutterwave does not allow updating expiry of existing accounts
 */
// Removed Flutterwave extended virtual account creation

/**
 * Force create a new wallet (for expired accounts)
 */
// Removed Flutterwave force create

/**
 * Check virtual account expiry status
 */
// Removed Flutterwave expiry check

// ===================== KoraPay NGN Virtual Bank Accounts =====================

/**
 * Create NGN Virtual Bank Account (KoraPay)
 * Requires: account_name, account_reference, permanent=true, bank_code, customer{name,email}, kyc{bvn,[nin]}
 */
export const korapayCreateVBA = async (req, res) => {
  try {
    const userId = req.user?.id
    const user = userId ? await findUserById(userId) : null

    const {
      account_name,
      account_reference,
      permanent = true,
      bank_code = "000",
      customer,
      kyc,
    } = req.body || {}

    if (!KORAPAY_SECRET_KEY) {
      return res.status(500).json({ message: "KoraPay secret key not configured" })
    }

    if (!account_name || !account_reference || typeof permanent !== "boolean" || !bank_code || !customer || !customer.name || !kyc || !kyc.bvn) {
      return res.status(400).json({ message: "Missing required fields for KoraPay VBA creation" })
    }

    // Ensure a stable, unique reference; if user present, prefix with userId
    const finalReference = userId ? `${account_reference}-${userId}` : account_reference

    const payload = {
      account_name,
      account_reference: finalReference,
      permanent: Boolean(permanent),
      bank_code,
      customer: {
        name: customer.name,
        ...(customer.email ? { email: customer.email } : {}),
      },
      kyc: {
        bvn: kyc.bvn,
        ...(kyc.nin ? { nin: kyc.nin } : {}),
      },
    }

    const data = await korapayRequest("POST", "/virtual-bank-account", payload)
    return res.status(201).json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * Retrieve NGN Virtual Bank Account by account_reference (KoraPay)
 */
export const korapayGetVBA = async (req, res) => {
  try {
    const { accountReference } = req.params
    if (!accountReference) return res.status(400).json({ message: "accountReference is required" })
    // Try exact reference first
    try {
      const data = await korapayRequest("GET", `/virtual-bank-account/${encodeURIComponent(accountReference)}`)
      return res.json(data)
    } catch (e) {
      // If the reference was created with userId suffix, try appending it
      const userId = req.user?.id
      if (userId && !accountReference.includes("-")) {
        try {
          const withUser = `${accountReference}-${userId}`
          const data2 = await korapayRequest("GET", `/virtual-bank-account/${encodeURIComponent(withUser)}`)
          return res.json(data2)
        } catch (e2) {
          // fall through
        }
      }
      throw e
    }
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * Webhook for KoraPay (charge.success)
 * We verify the payment using charges/:reference before crediting the wallet
 */
export const korapayWebhook = async (req, res) => {
  try {
    const { event, data } = req.body || {}
    if (!event || !data) return res.status(400).json({ message: "Invalid webhook payload" })

    if (event === "charge.success") {
      const reference = data.reference
      if (!reference) return res.status(200).json({ message: "No reference to verify" })

      // Verify charge
      let charge
      try {
        charge = await korapayRequest("GET", `/charges/${encodeURIComponent(reference)}`)
      } catch (e) {
        console.error("Failed to verify KoraPay charge:", e.message)
        return res.status(200).json({ message: "received" })
      }

      const status = charge?.data?.status || charge?.data?.data?.status || charge?.status
      if (status !== "success") {
        return res.status(200).json({ message: "Charge not successful" })
      }

      const amount = Number(charge?.data?.amount_paid || charge?.data?.amount || data.amount || 0)
      const currency = charge?.data?.currency || data.currency || "NGN"

      // Extract userId from account_reference if present (format we set: <ref>-<userId>)
      const accountReference = data?.virtual_bank_account_details?.virtual_bank_account?.account_reference || charge?.data?.virtual_bank_account?.account_reference
      let userIdFromRef = null
      if (accountReference && accountReference.includes("-")) {
        const parts = accountReference.split("-")
        const last = parts[parts.length - 1]
        if (/^\d+$/.test(last)) userIdFromRef = parseInt(last, 10)
      }

      if (userIdFromRef) {
        try {
          await createWalletTransaction(userIdFromRef, {
            reference,
            amount,
            currency,
            type: "credit",
            status: "success",
            description: "Wallet funding via KoraPay VBA",
            paystackReference: reference,
            metadata: JSON.stringify({ webhook: req.body, verified: charge }),
          })
          console.log(`Wallet credited for user ${userIdFromRef}: ${amount} ${currency}`)
        } catch (e) {
          console.error("Failed to record wallet transaction:", e.message)
        }
      }
    }

    return res.status(200).json({ message: "received" })
  } catch (error) {
    console.error("KoraPay webhook error:", error)
    return res.status(500).json({ message: "Webhook processing failed" })
  }
}

/**
 * Query a KoraPay charge by reference
 */
export const korapayGetCharge = async (req, res) => {
  try {
    const { reference } = req.params
    if (!reference) return res.status(400).json({ message: "reference is required" })
    const data = await korapayRequest("GET", `/charges/${encodeURIComponent(reference)}`)
    return res.json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * List transactions for a KoraPay virtual bank account (account_number required)
 * Query params: account_number (required), start_date, end_date, page, limit
 */
export const korapayListVBATransactions = async (req, res) => {
  try {
    const { account_number, start_date, end_date, page, limit } = req.query
    if (!account_number) return res.status(400).json({ message: "account_number is required" })
    const params = { account_number }
    if (start_date) params.start_date = start_date
    if (end_date) params.end_date = end_date
    if (page) params.page = page
    if (limit) params.limit = limit

    const data = await korapayRequest("GET", "/virtual-bank-account/transactions", null, params)
    return res.json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * Sandbox credit VBA (KoraPay)
 * Body: account_number, currency="NGN", amount
 */
export const korapaySandboxCredit = async (req, res) => {
  try {
    const { account_number, currency = "NGN", amount } = req.body || {}
    if (!account_number || !amount) return res.status(400).json({ message: "account_number and amount are required" })
    const payload = { account_number, currency, amount }
    const data = await korapayRequest("POST", "/virtual-bank-account/sandbox/credit", payload)
    return res.status(201).json(data)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * Initiate a one-time bank transfer (KoraPay) to generate a temporary account
 * Body: account_name, amount, currency, reference, customer{name,email}
 */
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

/**
 * Confirm a charge by reference and credit user's wallet on success
 * Path: :reference
 */
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

