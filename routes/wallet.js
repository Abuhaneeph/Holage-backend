import express from "express"
import {
  getWallet,
  getTransactionHistory,
  // KoraPay
  korapayCreateVBA,
  korapayGetVBA,
  korapayWebhook,
  korapayGetCharge,
  korapayListVBATransactions,
  korapaySandboxCredit,
  korapayInitiateBankTransfer,
  korapayConfirmChargeAndCredit,
} from "../controllers/walletController.js"
import {
  opayCreateWallet,
  opayQueryWallet,
  opayQueryTransactions,
  opayQueryBalance,
  opaySweep,
  opayQuerySweepStatus,
  opayUpdateWallet,
  opayDeleteWallets,
  opayWebhook
} from "../controllers/opayController.js"
import { authenticate } from "../middleware/auth.js"

const router = express.Router()

// Protected routes (require authentication)
router.get("/", authenticate, getWallet)
router.get("/transactions", authenticate, getTransactionHistory)

// KoraPay NGN Virtual Bank Accounts
router.post("/korapay/vba", authenticate, korapayCreateVBA)
router.get("/korapay/vba/:accountReference", authenticate, korapayGetVBA)
router.get("/korapay/vba/transactions", authenticate, korapayListVBATransactions)
router.get("/korapay/charges/:reference", authenticate, korapayGetCharge)
router.post("/korapay/charges/bank-transfer", authenticate, korapayInitiateBankTransfer)
router.post("/korapay/charges/:reference/confirm", authenticate, korapayConfirmChargeAndCredit)
router.post("/korapay/sandbox/credit", authenticate, korapaySandboxCredit)
router.post("/korapay/webhook", korapayWebhook)

// OPay Digital Wallets
router.post("/opay/wallet/create", authenticate, opayCreateWallet)
router.post("/opay/wallet/query", authenticate, opayQueryWallet)
router.post("/opay/wallet/transactions", authenticate, opayQueryTransactions)
router.post("/opay/wallet/balance", authenticate, opayQueryBalance)
router.post("/opay/wallet/sweep", authenticate, opaySweep)
router.post("/opay/wallet/sweep/query", authenticate, opayQuerySweepStatus)
router.post("/opay/wallet/update", authenticate, opayUpdateWallet)
router.post("/opay/wallet/delete", authenticate, opayDeleteWallets)
router.post("/opay/webhook", opayWebhook)

export default router

