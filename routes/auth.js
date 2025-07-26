import express from "express"
import { register, login, verifyEmail, forgotPassword, resetPassword, verifyResetCode } from "../controllers/authController.js"

const router = express.Router()

router.post("/register", register)
router.post("/login", login)
router.post("/verify-email", verifyEmail)
router.post("/forgot-password", forgotPassword)
router.post("/reset-password", resetPassword)
// Add this route to your auth routes file
router.post('/verify-reset-code', verifyResetCode)

export default router
