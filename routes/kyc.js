import express from "express"
import { submitKyc, getKycStatus } from "../controllers/kycController.js"
import { protect ,requireEmailVerification} from "../middleware/auth.js"

const router = express.Router()

router.post("/submit", protect, requireEmailVerification, submitKyc)
router.get("/status", protect, getKycStatus)

export default router
