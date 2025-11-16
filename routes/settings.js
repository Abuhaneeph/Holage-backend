import express from "express"
import { authenticate, authorizeRoles } from "../middleware/auth.js"
import {
  getSetting,
  getDieselRate,
  updateSetting,
  updateDieselRate
} from "../controllers/settingsController.js"

const router = express.Router()

// Public route to get diesel rate
router.get("/diesel-rate", getDieselRate)

// Admin routes - require admin role
router.get("/:key", authenticate, authorizeRoles("admin"), getSetting)
router.put("/:key", authenticate, authorizeRoles("admin"), updateSetting)
router.put("/diesel-rate/update", authenticate, authorizeRoles("admin"), updateDieselRate)

export default router

