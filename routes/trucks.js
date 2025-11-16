import express from "express"
import { authenticate, authorizeRoles } from "../middleware/auth.js"
import {
  createTruckController,
  getMyTrucks,
  getTruck,
  updateTruckController,
  deleteTruckController,
} from "../controllers/truckController.js"

const router = express.Router()

// All routes require authentication and fleet_manager role
router.use(authenticate)
router.use(authorizeRoles('fleet_manager'))

// Create a new truck
router.post("/", createTruckController)

// Get all trucks for the authenticated fleet manager
router.get("/", getMyTrucks)

// Get a single truck by ID
router.get("/:truckId", getTruck)

// Update a truck
router.put("/:truckId", updateTruckController)

// Delete a truck
router.delete("/:truckId", deleteTruckController)

export default router

