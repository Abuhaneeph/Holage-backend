import express from "express"
import {
  createWallet,
  getWallet,
  getAvailableBanks,
  getTransactionHistory,
  flutterwaveWebhook,
  getUserVirtualAccounts,
  getVirtualAccountById,
  createExtendedVirtualAccount,
  forceCreateWallet,
  checkVirtualAccountExpiry,
} from "../controllers/walletController.js"
import { authenticate } from "../middleware/auth.js"

const router = express.Router()

// Protected routes (require authentication)
router.post("/create", authenticate, createWallet)
router.post("/create-extended", authenticate, createExtendedVirtualAccount)
router.post("/force-create", authenticate, forceCreateWallet)
router.get("/", authenticate, getWallet)
router.get("/accounts", authenticate, getUserVirtualAccounts)
router.get("/accounts/:virtualAccountId", authenticate, getVirtualAccountById)
router.get("/accounts/:virtualAccountId/expiry", authenticate, checkVirtualAccountExpiry)
router.get("/transactions", authenticate, getTransactionHistory)
router.get("/currencies", authenticate, getAvailableBanks)

// Webhook route (no authentication - verified by signature)
router.post("/webhook", flutterwaveWebhook)

export default router

