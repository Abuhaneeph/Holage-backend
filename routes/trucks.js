import express from "express"
import { authenticate, authorizeRoles } from "../middleware/auth.js"
import {
  createTruckController,
  getMyTrucks,
  getTruck,
  updateTruckController,
  deleteTruckController,
  getMyAssignedTrucks,
} from "../controllers/truckController.js"

const router = express.Router()

// Route for drivers to get their assigned trucks (must be before fleet_manager middleware)
router.get("/my-assigned", authenticate, authorizeRoles("driver"), getMyAssignedTrucks)

// All other routes require authentication and fleet_manager role
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

