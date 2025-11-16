import express from "express"
import { authenticate, authorizeRoles } from "../middleware/auth.js"
import {
  submitComplaint,
  getAllComplaints,
  getComplaintById,
  updateComplaint,
  getMyComplaints,
  addComplaintMessage,
  getComplaintMessages,
} from "../controllers/complaintController.js"

const router = express.Router()

// Submit a complaint (all authenticated users)
router.post("/submit", authenticate, submitComplaint)

// Get user's own complaints (all authenticated users)
router.get("/my-complaints", authenticate, getMyComplaints)

// Add message/reply to complaint (authenticated users - owner or admin)
router.post("/:complaintId/messages", authenticate, addComplaintMessage)

// Get messages for a complaint (authenticated users - owner or admin)
router.get("/:complaintId/messages", authenticate, getComplaintMessages)

// Admin-only routes
router.use(authenticate)
router.use(authorizeRoles("admin"))

// Get all complaints (admin only)
router.get("/", getAllComplaints)

// Get a single complaint by ID with messages (admin only)
router.get("/:complaintId", getComplaintById)

// Update complaint status (admin only)
router.put("/:complaintId", updateComplaint)

export default router

