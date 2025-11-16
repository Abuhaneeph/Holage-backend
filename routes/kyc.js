import express from "express"
import { submitKyc, getKycStatus, getKycDocuments, getAllKycSubmissions, getKycSubmissionById, updateKycStatus, updateBankAccount } from "../controllers/kycController.js"
import { protect, requireEmailVerification, authenticate, authorizeRoles } from "../middleware/auth.js"

const router = express.Router()

// User routes
router.post("/submit", protect, requireEmailVerification, submitKyc)
router.get("/status", protect, getKycStatus)
router.get("/documents", protect, getKycDocuments)
router.put("/bank-account", protect, updateBankAccount) // Update bank account details from profile

// Admin routes
router.get("/admin/submissions", authenticate, authorizeRoles("admin"), getAllKycSubmissions)
router.get("/admin/submissions/:userId", authenticate, authorizeRoles("admin"), getKycSubmissionById)
router.put("/admin/submissions/:userId/status", authenticate, authorizeRoles("admin"), updateKycStatus)

export default router
