import axios from "axios"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { OpayRSA } from "../utils/opayRsa.js"
import { findUserById, updateUserWallet, createWalletTransaction, getWalletBalance } from "../models/User.js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OPAY_BASE_URL = process.env.OPAY_BASE_URL || "https://payapi.opayweb.com"
const OPAY_MERCHANT_ID = process.env.OPAY_MERCHANT_ID

// Load keys from files or env
let OPAY_PUBLIC_KEY = process.env.OPAY_PUBLIC_KEY
let MERCHANT_PRIVATE_KEY = process.env.MERCHANT_PRIVATE_KEY

// Try loading from files if env vars are incomplete
try {
  const opayPubPath = path.join(__dirname, "../keys/opay_public_key.pem")
  const merchantPrivPath = path.join(__dirname, "../keys/merchant_private_key_pkcs8.pem")
  
  if (fs.existsSync(opayPubPath)) {
    OPAY_PUBLIC_KEY = fs.readFileSync(opayPubPath, "utf8")
    console.log("✓ Loaded OPay public key from file")
  }
  
  if (fs.existsSync(merchantPrivPath)) {
    MERCHANT_PRIVATE_KEY = fs.readFileSync(merchantPrivPath, "utf8")
    if (!MERCHANT_PRIVATE_KEY || MERCHANT_PRIVATE_KEY.trim().length === 0) {
      console.error("⚠ Merchant private key file is empty!")
    } else {
      const firstLine = MERCHANT_PRIVATE_KEY.split("\n")[0]
      console.log("✓ Loaded merchant private key (PKCS#8) from file")
      console.log("  Length:", MERCHANT_PRIVATE_KEY.length, "chars")
      console.log("  Format:", firstLine)
    }
  } else {
    console.warn("⚠ Merchant private key file not found at:", merchantPrivPath)
  }
} catch (e) {
  console.error("Error loading keys from files:", e.message)
  console.log("Keys will be loaded from env variables")
}

// Validate keys before creating RSA instance
if (!MERCHANT_PRIVATE_KEY || MERCHANT_PRIVATE_KEY.trim().length === 0) {
  console.error("❌ MERCHANT_PRIVATE_KEY is missing or empty!")
}
if (!OPAY_PUBLIC_KEY || OPAY_PUBLIC_KEY.trim().length === 0) {
  console.error("❌ OPAY_PUBLIC_KEY is missing or empty!")
}

const opayRsa = new OpayRSA({
  opayPublicKey: OPAY_PUBLIC_KEY,
  merchantPrivateKey: MERCHANT_PRIVATE_KEY
})

/**
 * Make OPay API request with RSA encryption
 */
const opayRequest = async (endpoint, params) => {
  const timestamp = Date.now()
  const encryptedData = opayRsa.encrypt(params, timestamp)

  const headers = {
    "Content-Type": "application/json",
    "clientAuthKey": process.env.OPAY_CLIENT_AUTH_KEY || "",
    "version": "V1.0.1",
    "bodyFormat": "JSON",
    "timestamp": timestamp.toString()
  }

  const response = await axios.post(`${OPAY_BASE_URL}${endpoint}`, encryptedData, { headers })

  const { code, message, data } = response.data
  if (code !== "00000") {
    throw new Error(message || "OPay request failed")
  }

  // Decrypt response if data is encrypted
  if (data) {
    const decrypted = opayRsa.decrypt(response.data)
    if (!decrypted.verify) {
      console.warn("OPay signature verification failed")
    }
    return { code, message, data: decrypted.data }
  }

  return response.data
}

/**
 * Create Digital Wallet (OPay)
 */
export const opayCreateWallet = async (req, res) => {
  try {
    const userId = req.user?.id
    const { name, refId, email, phone, accountType = "Merchant", sendPassWordFlag = "N" } = req.body || {}

    console.log("OPay Public Key loaded:", !!OPAY_PUBLIC_KEY)
    console.log("Merchant Private Key loaded:", !!MERCHANT_PRIVATE_KEY)
    console.log("OPay Merchant ID:", OPAY_MERCHANT_ID)

    if (!OPAY_PUBLIC_KEY || !MERCHANT_PRIVATE_KEY || !OPAY_MERCHANT_ID) {
      return res.status(500).json({ 
        message: "OPay credentials not configured",
        debug: {
          hasPublicKey: !!OPAY_PUBLIC_KEY,
          hasPrivateKey: !!MERCHANT_PRIVATE_KEY,
          hasMerchantId: !!OPAY_MERCHANT_ID
        }
      })
    }

    if (!name) {
      return res.status(400).json({ message: "name is required" })
    }

    if (!refId && !email && !phone) {
      return res.status(400).json({ message: "At least one of refId, email, or phone is required" })
    }

    console.log("Creating OPay wallet with payload:", { name, refId, email, phone, accountType })

    const payload = {
      opayMerchantId: OPAY_MERCHANT_ID,
      name,
      accountType,
      sendPassWordFlag,
      ...(refId ? { refId } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {})
    }

    const result = await opayRequest("/api/v2/third/depositcode/generateStaticDepositCode", payload)

    // Optionally persist wallet to user if userId present
    if (userId && result.data?.depositCode) {
      await updateUserWallet(userId, {
        paystackCustomerCode: null,
        paystackCustomerId: null,
        walletAccountNumber: result.data.depositCode,
        walletAccountName: result.data.name,
        walletBankName: "OPay",
        walletBankSlug: "opay",
        walletBankId: null,
        walletActive: true,
        walletCurrency: "NGN",
        dedicatedAccountId: result.data.depositCode
      })
    }

    return res.status(201).json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * Query Digital Wallet Details (OPay)
 */
export const opayQueryWallet = async (req, res) => {
  try {
    const { depositCode } = req.body || {}
    if (!depositCode) return res.status(400).json({ message: "depositCode is required" })

    const payload = {
      opayMerchantId: OPAY_MERCHANT_ID,
      depositCode
    }

    const result = await opayRequest("/api/v2/third/depositcode/queryStaticDepositCodeInfo", payload)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * Query Wallet Transaction History (OPay)
 */
export const opayQueryTransactions = async (req, res) => {
  try {
    const { depositCodes, pageNo = 1, pageSize = 10, startTime, endTime } = req.body || {}

    const payload = {
      opayMerchantId: OPAY_MERCHANT_ID,
      pageNo: Number(pageNo),
      pageSize: Number(pageSize),
      ...(depositCodes ? { depositCodes } : {}),
      ...(startTime ? { startTime: Number(startTime) } : {}),
      ...(endTime ? { endTime: Number(endTime) } : {})
    }

    const result = await opayRequest("/api/v2/third/depositcode/queryStaticDepositCodeTransList", payload)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * Query Wallet Balance (OPay)
 */
export const opayQueryBalance = async (req, res) => {
  try {
    const { depositCode } = req.body || {}
    if (!depositCode) return res.status(400).json({ message: "depositCode is required" })

    const payload = {
      opayMerchantId: OPAY_MERCHANT_ID,
      depositCode
    }

    const result = await opayRequest("/api/v2/third/depositcode/queryWalletBalance", payload)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * Sweep funds from Digital Wallet to merchant account (OPay)
 */
export const opaySweep = async (req, res) => {
  try {
    const { amount, depositCode, collectionMerchantId, requestSerialNo, description } = req.body || {}

    if (!amount || !depositCode || !requestSerialNo || !description) {
      return res.status(400).json({ message: "amount, depositCode, requestSerialNo, description are required" })
    }

    const payload = {
      amount,
      depositCode,
      opayMerchantId: OPAY_MERCHANT_ID,
      collectionMerchantId: collectionMerchantId || OPAY_MERCHANT_ID,
      requestSerialNo,
      description
    }

    const result = await opayRequest("/api/v2/third/depositcode/transferToMerchant", payload)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * Query Sweep Status (OPay)
 */
export const opayQuerySweepStatus = async (req, res) => {
  try {
    const { orderNo, requestSerialNo } = req.body || {}
    if (!orderNo || !requestSerialNo) {
      return res.status(400).json({ message: "orderNo and requestSerialNo are required" })
    }

    const payload = {
      opayMerchantId: OPAY_MERCHANT_ID,
      orderNo,
      requestSerialNo
    }

    const result = await opayRequest("/api/v2/third/depositcode/queryTransferStatus", payload)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * Update Digital Wallet Details (OPay)
 */
export const opayUpdateWallet = async (req, res) => {
  try {
    const { depositCode, email, phone, name, sendPassWordFlag = "N", refId } = req.body || {}

    if (!depositCode) return res.status(400).json({ message: "depositCode is required" })
    if (!email && !phone) {
      return res.status(400).json({ message: "At least one of email or phone is required" })
    }

    const payload = {
      opayMerchantId: OPAY_MERCHANT_ID,
      depositCode,
      sendPassWordFlag,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(name ? { name } : {}),
      ...(refId ? { refId } : {})
    }

    const result = await opayRequest("/api/v2/third/depositcode/updateWallet", payload)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * Delete Digital Wallets (OPay)
 */
export const opayDeleteWallets = async (req, res) => {
  try {
    const { depositCodes } = req.body || {}
    if (!depositCodes || !Array.isArray(depositCodes)) {
      return res.status(400).json({ message: "depositCodes array is required" })
    }

    const payload = {
      opayMerchantId: OPAY_MERCHANT_ID,
      depositCodes
    }

    const result = await opayRequest("/api/v2/third/depositcode/deleteWallet", payload)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

/**
 * OPay Webhook handler (payment notification)
 */
export const opayWebhook = async (req, res) => {
  try {
    const { status, transactionId, depositCode, refId, depositAmount, currency, reference, orderNo } = req.body || {}

    if (status === "SUCCESS") {
      // Extract userId from refId if it follows pattern <prefix>-<userId>
      let userIdFromRef = null
      if (refId && refId.includes("-")) {
        const parts = refId.split("-")
        const last = parts[parts.length - 1]
        if (/^\d+$/.test(last)) userIdFromRef = parseInt(last, 10)
      }

      if (userIdFromRef) {
        try {
          await createWalletTransaction(userIdFromRef, {
            reference: transactionId || reference || orderNo,
            amount: parseFloat(depositAmount || 0),
            currency: currency || "NGN",
            type: "credit",
            status: "success",
            description: "Wallet funding via OPay Digital Wallet",
            paystackReference: transactionId,
            metadata: JSON.stringify(req.body)
          })
          console.log(`OPay wallet credited for user ${userIdFromRef}: ${depositAmount} ${currency}`)
        } catch (e) {
          console.error("Failed to record OPay wallet transaction:", e.message)
        }
      }
    }

    return res.status(200).json({ code: "00000", message: "SUCCESSFUL" })
  } catch (error) {
    console.error("OPay webhook error:", error)
    return res.status(500).json({ code: "99999", message: "Webhook processing failed" })
  }
}

