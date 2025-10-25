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

/**
 * Create a Virtual Account for a user using Flutterwave
 */
export const createWallet = async (req, res) => {
  const userId = req.user.id
  const { currency = "NGN", account_type = "dynamic", amount = 1, expiry = 86400 } = req.body // Default: 24 hours

  try {
    // Get user details
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Check if user already has an active wallet
    if (user.walletAccountNumber && user.walletActive) {
      // Check if the existing wallet is expired
      if (user.dedicatedAccountId) {
        try {
          console.log(`🔍 Checking if existing wallet is expired: ${user.dedicatedAccountId}`)
          const existingWalletResponse = await flutterwaveRequest("GET", `/virtual-accounts/${user.dedicatedAccountId}`)
          
          if (existingWalletResponse.status === "success") {
            const existingWallet = existingWalletResponse.data
            const expirationDate = new Date(existingWallet.account_expiration_datetime)
            const now = new Date()
            
            if (expirationDate > now) {
              // Wallet is still active
              return res.status(400).json({
                message: "Active wallet already exists for this user",
                wallet: {
                  id: existingWallet.id,
                  accountNumber: existingWallet.account_number,
                  accountName: existingWallet.account_name,
                  bankName: existingWallet.account_bank_name,
                  currency: existingWallet.currency,
                  status: existingWallet.status,
                  expirationDatetime: existingWallet.account_expiration_datetime,
                },
              })
            } else {
              // Wallet is expired, allow creation of new one
              console.log(`⚠️ Existing wallet is expired, allowing creation of new wallet`)
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not check existing wallet status: ${error.message}`)
          // If we can't check the status, assume it's expired and allow creation
        }
      } else {
        // No dedicatedAccountId, assume wallet is inactive/expired
        console.log(`⚠️ Existing wallet has no dedicatedAccountId, allowing creation of new wallet`)
      }
    }

    // Check if KYC is approved (optional but recommended)
    if (user.kycStatus !== "approved") {
      return res.status(403).json({
        message: "KYC verification required. Please complete KYC verification before creating a wallet.",
        kycStatus: user.kycStatus,
      })
    }

    // Step 1: Check if customer exists in Flutterwave or create one
    let flutterwaveCustomerId = user.paystackCustomerCode // Reusing this field for Flutterwave customer_id

    if (!flutterwaveCustomerId) {
      console.log("🔍 Checking if customer exists in Flutterwave...")
      
      // Search for existing customer by email
      try {
        const searchResponse = await flutterwaveRequest("GET", `/customers?email=${encodeURIComponent(user.email)}`)
        
        console.log("📥 Customer search response:", JSON.stringify(searchResponse, null, 2))

        if (searchResponse.status === "success" && searchResponse.data?.length > 0) {
          // Customer exists
          flutterwaveCustomerId = searchResponse.data[0].id
          console.log(`✅ Customer found: ${flutterwaveCustomerId}`)
          
          // Save customer_id to database
          await pool.execute(
            "UPDATE users SET paystackCustomerCode = ? WHERE id = ?",
            [flutterwaveCustomerId, userId]
          )
        } else {
          console.log("ℹ️ No existing customer found, will create new one")
        }
      } catch (searchError) {
        console.log("⚠️ Customer search failed, will create new customer:", searchError.message)
      }
    }

    // If customer doesn't exist, create one
    if (!flutterwaveCustomerId) {
      console.log("📝 Creating new customer in Flutterwave...")
      
      const customerData = {
        email: user.email,
        full_name: user.fullName,
        phone: user.phone || undefined,
      }

      console.log("📤 Customer data being sent:", JSON.stringify(customerData, null, 2))

      try {
        const customerResponse = await flutterwaveRequest("POST", "/customers", customerData)
        
        console.log("📥 Customer creation response:", JSON.stringify(customerResponse, null, 2))

        if (customerResponse.status === "success") {
          flutterwaveCustomerId = customerResponse.data.id
          console.log(`✅ Customer created: ${flutterwaveCustomerId}`)
          
          // Save customer_id to database
          await pool.execute(
            "UPDATE users SET paystackCustomerCode = ? WHERE id = ?",
            [flutterwaveCustomerId, userId]
          )
        } else {
          console.error("❌ Customer creation failed - invalid response:", customerResponse)
          throw new Error(`Failed to create customer in Flutterwave: ${customerResponse.message || 'Unknown error'}`)
        }
      } catch (createError) {
        console.error("❌ Customer creation failed:", createError.message)
        return res.status(500).json({
          message: "Failed to create customer in Flutterwave",
          error: createError.message
        })
      }
    }

    // Step 2: Create virtual account with customer_id
    console.log("💳 Creating virtual account...")
    
    // Generate unique reference for this transaction (alphanumeric only, no special characters)
    const reference = `HOLAGEWALLET${userId}${Date.now()}`

    // Prepare request data for Flutterwave virtual account
    const requestData = {
      reference: reference,
      customer_id: flutterwaveCustomerId, // Use Flutterwave customer_id
      amount: amount, // 0 for static accounts
      expiry: expiry, // Expiry time in seconds (default: 360 seconds = 6 minutes)
      currency: currency,
      account_type: account_type,
      narration: `${user.fullName} - Holage Wallet`, // Narration at root level
    }

    // Add BVN if available (must be exactly 11 digits)
    if (user.bvn && currency === "NGN") {
      const bvnClean = user.bvn.replace(/\D/g, '') // Remove non-digits
      if (bvnClean.length === 11) {
        requestData.bvn = bvnClean // BVN at root level, not in meta
      }
    }

    // Add NIN if available (must be exactly 11 digits)
    if (user.nin && currency === "NGN") {
      const ninClean = user.nin.replace(/\D/g, '') // Remove non-digits
      if (ninClean.length === 11) {
        requestData.nin = ninClean // NIN at root level, not in meta
      }
    }
    
    // Add phone if available
    if (user.phone) {
      requestData.phone = user.phone
    }

    // Log request data for debugging
    console.log("📤 Sending to Flutterwave:")
    console.log(JSON.stringify(requestData, null, 2))
    
    // Create virtual account
    const flutterwaveResponse = await flutterwaveRequest("POST", "/virtual-accounts", requestData)

    if (flutterwaveResponse.status === "success") {
      // Extract wallet details from Flutterwave response
      const walletData = flutterwaveResponse.data

      // Save wallet information to database
      await updateUserWallet(userId, {
        paystackCustomerCode: flutterwaveCustomerId, // Store Flutterwave customer_id
        paystackCustomerId: null,
        walletAccountNumber: walletData.account_number,
        walletAccountName: user.fullName,
        walletBankName: walletData.account_bank_name,
        walletBankSlug: walletData.account_bank_name?.toLowerCase().replace(/\s+/g, "-"),
        walletBankId: null,
        walletActive: walletData.status === "active",
        walletCurrency: walletData.currency || currency,
        dedicatedAccountId: walletData.id,
      })

      return res.status(201).json({
        message: "Wallet created successfully",
        wallet: {
          id: walletData.id,
          accountNumber: walletData.account_number,
          accountName: user.fullName,
          bankName: walletData.account_bank_name,
          currency: walletData.currency,
          accountType: walletData.account_type,
          status: walletData.status,
          reference: walletData.reference,
          customerId: walletData.customer_id,
          expirationDatetime: walletData.account_expiration_datetime,
          createdDatetime: walletData.created_datetime,
        },
      })
    } else {
      return res.status(400).json({
        message: "Failed to create wallet",
        error: flutterwaveResponse.message,
      })
    }
  } catch (error) {
    console.error("Create wallet error:", error)
    return res.status(500).json({
      message: "Server error during wallet creation",
      error: error.message,
    })
  }
}

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
export const getAvailableBanks = async (req, res) => {
  try {
    // Flutterwave supports NGN, GHS, KES, EGP for virtual accounts
    const supportedCurrencies = [
      { currency: "NGN", country: "Nigeria", banks: ["Wema Bank"] },
      { currency: "GHS", country: "Ghana", banks: ["Available Banks"] },
      { currency: "KES", country: "Kenya", banks: ["Available Banks"] },
      { currency: "EGP", country: "Egypt", banks: ["Available Banks"] },
    ]

    return res.status(200).json({
      message: "Supported currencies fetched successfully",
      currencies: supportedCurrencies,
    })
  } catch (error) {
    console.error("Get available banks error:", error)
    return res.status(500).json({
      message: "Server error fetching available currencies",
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

    if (!user.walletAccountNumber) {
      return res.status(404).json({ message: "No wallet found for this user" })
    }

    const offset = (page - 1) * limit
    const transactions = await getWalletTransactions(userId, parseInt(limit), parseInt(offset))

    return res.status(200).json({
      message: "Transaction history fetched successfully",
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
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
export const flutterwaveWebhook = async (req, res) => {
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH
  const signature = req.headers["verif-hash"]

  // Verify webhook signature
  if (!signature || signature !== secretHash) {
    return res.status(401).json({ message: "Invalid signature" })
  }

  const event = req.body

  try {
    // Handle charge completed event
    if (event.event === "charge.completed" || event.event === "transfer") {
      const { customer, amount, currency, tx_ref, status } = event.data

      // Only process successful transactions
      if (status === "successful") {
        // Find user by customer ID or reference
        const customerId = customer?.id || event.data.customer_id

        if (customerId) {
          const [users] = await pool.execute("SELECT id FROM users WHERE id = ?", [customerId])

          if (users.length > 0) {
            const userId = users[0].id

            // Record the transaction
            await createWalletTransaction(userId, {
              reference: tx_ref,
              amount: amount,
              currency: currency,
              type: "credit",
              status: "success",
              description: `Wallet funding via bank transfer`,
              paystackReference: tx_ref,
              metadata: JSON.stringify(event.data),
            })

            console.log(`Wallet credited for user ${userId}: ${amount} ${currency}`)
          }
        }
      }
    }

    res.status(200).json({ message: "Webhook received" })
  } catch (error) {
    console.error("Webhook processing error:", error)
    res.status(500).json({ message: "Webhook processing failed" })
  }
}

/**
 * Get all virtual accounts for a user (if multiple accounts exist)
 */
export const getUserVirtualAccounts = async (req, res) => {
  const userId = req.user.id

  try {
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Call Flutterwave API to get all virtual accounts for this user
    const flutterwaveResponse = await flutterwaveRequest(
      "GET",
      `/virtual-accounts?customer_id=${userId}`
    )

    if (flutterwaveResponse.status === "success") {
      return res.status(200).json({
        message: "Virtual accounts fetched successfully",
        accounts: flutterwaveResponse.data,
      })
    } else {
      return res.status(400).json({
        message: "Failed to fetch virtual accounts",
        error: flutterwaveResponse.message,
      })
    }
  } catch (error) {
    console.error("Get virtual accounts error:", error)
    return res.status(500).json({
      message: "Server error fetching virtual accounts",
      error: error.message,
    })
  }
}

export const getVirtualAccountById = async (req, res) => {
  const { virtualAccountId } = req.params

  try {
    console.log(`🔍 Retrieving virtual account: ${virtualAccountId}`)

    // Call Flutterwave API to get virtual account details
    const flutterwaveResponse = await flutterwaveRequest("GET", `/virtual-accounts/${virtualAccountId}`)

    if (flutterwaveResponse.status === "success") {
      const virtualAccount = flutterwaveResponse.data

      return res.json({
        message: "Virtual account retrieved successfully",
        virtualAccount: {
          id: virtualAccount.id,
          accountNumber: virtualAccount.account_number,
          accountName: virtualAccount.account_name,
          bankName: virtualAccount.account_bank_name,
          currency: virtualAccount.currency,
          accountType: virtualAccount.account_type,
          status: virtualAccount.status,
          reference: virtualAccount.reference,
          customerId: virtualAccount.customer_id,
          customerReference: virtualAccount.customer_reference,
          amount: virtualAccount.amount,
          expirationDatetime: virtualAccount.account_expiration_datetime,
          createdDatetime: virtualAccount.created_datetime,
          note: virtualAccount.note,
          meta: virtualAccount.meta,
        },
      })
    } else {
      return res.status(400).json({
        message: "Failed to retrieve virtual account",
        error: flutterwaveResponse.message,
      })
    }
  } catch (error) {
    console.error("Get virtual account by ID error:", error)
    return res.status(500).json({
      message: "Server error during virtual account retrieval",
      error: error.message,
    })
  }
}

/**
 * Create a new virtual account with extended expiry
 * Note: Flutterwave does not allow updating expiry of existing accounts
 */
export const createExtendedVirtualAccount = async (req, res) => {
  const userId = req.user.id
  const { expiry = 86400 } = req.body // Default: 24 hours

  try {
    console.log(`🔄 Creating new virtual account with extended expiry: ${expiry} seconds`)

    if (!expiry || expiry < 60 || expiry > 31536000) {
      return res.status(400).json({
        message: "Invalid expiry time. Must be between 60 and 31536000 seconds",
      })
    }

    // Create a new virtual account with the specified expiry
    // This will reuse the existing createWallet logic but with custom expiry
    req.body = {
      ...req.body,
      currency: "NGN",
      account_type: "static",
      amount: 1,
      expiry: expiry
    }

    // Call the existing createWallet function
    return await createWallet(req, res)

  } catch (error) {
    console.error("Create extended virtual account error:", error)
    return res.status(500).json({
      message: "Server error creating extended virtual account",
      error: error.message,
    })
  }
}

/**
 * Force create a new wallet (for expired accounts)
 */
export const forceCreateWallet = async (req, res) => {
  const userId = req.user.id
  const { currency = "NGN", account_type = "static", amount = 1, expiry = 86400 } = req.body

  try {
    console.log(`🔄 Force creating new wallet for user: ${userId}`)

    // Get user details
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Check if KYC is approved (optional but recommended)
    if (user.kycStatus !== "approved") {
      return res.status(403).json({
        message: "KYC verification required. Please complete KYC verification before creating a wallet.",
        kycStatus: user.kycStatus,
      })
    }

    // Mark existing wallet as inactive before creating new one
    if (user.walletAccountNumber) {
      console.log(`⚠️ Marking existing wallet as inactive`)
      await pool.execute(
        "UPDATE users SET walletActive = 0 WHERE id = ?",
        [userId]
      )
    }

    // Set the request body and call createWallet
    req.body = {
      currency,
      account_type,
      amount,
      expiry
    }

    // Call the existing createWallet function
    return await createWallet(req, res)

  } catch (error) {
    console.error("Force create wallet error:", error)
    return res.status(500).json({
      message: "Server error force creating wallet",
      error: error.message,
    })
  }
}

/**
 * Check virtual account expiry status
 */
export const checkVirtualAccountExpiry = async (req, res) => {
  const { virtualAccountId } = req.params

  try {
    console.log(`⏰ Checking virtual account expiry: ${virtualAccountId}`)

    // Call Flutterwave API to get virtual account details
    const flutterwaveResponse = await flutterwaveRequest("GET", `/virtual-accounts/${virtualAccountId}`)

    if (flutterwaveResponse.status === "success") {
      const virtualAccount = flutterwaveResponse.data
      const expirationDate = new Date(virtualAccount.account_expiration_datetime)
      const now = new Date()
      const timeUntilExpiry = expirationDate.getTime() - now.getTime()
      const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60))
      const minutesUntilExpiry = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60))

      const isExpired = timeUntilExpiry <= 0
      const isExpiringSoon = timeUntilExpiry <= (60 * 60 * 1000) // 1 hour

      return res.json({
        message: "Virtual account expiry status retrieved successfully",
        status: {
          isExpired,
          isExpiringSoon,
          expirationDate: virtualAccount.account_expiration_datetime,
          timeUntilExpiry: timeUntilExpiry,
          hoursUntilExpiry: Math.max(0, hoursUntilExpiry),
          minutesUntilExpiry: Math.max(0, minutesUntilExpiry),
          accountStatus: virtualAccount.status,
        },
        virtualAccount: {
          id: virtualAccount.id,
          accountNumber: virtualAccount.account_number,
          accountName: virtualAccount.account_name,
          bankName: virtualAccount.account_bank_name,
          currency: virtualAccount.currency,
          accountType: virtualAccount.account_type,
          status: virtualAccount.status,
          reference: virtualAccount.reference,
          customerId: virtualAccount.customer_id,
        },
      })
    } else {
      return res.status(400).json({
        message: "Failed to retrieve virtual account expiry status",
        error: flutterwaveResponse.message,
      })
    }
  } catch (error) {
    console.error("Check virtual account expiry error:", error)
    return res.status(500).json({
      message: "Server error checking virtual account expiry",
      error: error.message,
    })
  }
}
