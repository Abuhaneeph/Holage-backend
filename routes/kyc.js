import express from "express"
import { submitKyc, getKycStatus, getKycDocuments } from "../controllers/kycController.js"
import { protect ,requireEmailVerification} from "../middleware/auth.js"

const router = express.Router()

router.post("/submit", protect, requireEmailVerification, submitKyc)
router.get("/status", protect, getKycStatus)
router.get("/documents", protect, getKycDocuments)

export default router
