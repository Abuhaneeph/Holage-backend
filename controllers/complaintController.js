import pool from "../config/db.js"

/**
 * Submit a complaint (for all users)
 */
export const submitComplaint = async (req, res) => {
  try {
    const userId = req.user.id
    const { subject, message, shipmentId } = req.body

    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required." })
    }

    // Get user details
    const [userRows] = await pool.execute(
      "SELECT fullName, email, role FROM users WHERE id = ?",
      [userId]
    )

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found." })
    }

    const user = userRows[0]

    // If shipmentId is provided, validate it exists and user has access
    if (shipmentId) {
      const [shipmentRows] = await pool.execute(
        "SELECT shipperId, truckerId FROM shipments WHERE id = ?",
        [shipmentId]
      )

      if (shipmentRows.length === 0) {
        return res.status(404).json({ message: "Shipment not found." })
      }

      const shipment = shipmentRows[0]
      
      // Check if user is the shipper or trucker of this shipment
      if (shipment.shipperId !== userId && shipment.truckerId !== userId && user.role !== "admin") {
        return res.status(403).json({ message: "You can only file complaints for shipments you are involved in." })
      }
    }

    // Insert complaint
    const [result] = await pool.execute(
      `INSERT INTO complaints (userId, shipmentId, userEmail, userName, userRole, subject, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, shipmentId || null, user.email, user.fullName, user.role, subject, message]
    )

    res.status(201).json({
      success: true,
      message: "Complaint submitted successfully. We will review it shortly.",
      complaintId: result.insertId,
    })
  } catch (error) {
    console.error("Error submitting complaint:", error)
    res.status(500).json({ message: "Server error while submitting complaint." })
  }
}

/**
 * Get all complaints (admin only)
 */
export const getAllComplaints = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 20
    const offset = (pageNum - 1) * limitNum

    let query = `
      SELECT 
        c.*,
        u.fullName as resolvedByName,
        s.id as shipmentId,
        s.pickupState,
        s.pickupLga,
        s.destinationState,
        s.destinationLga,
        s.status as shipmentStatus,
        s.createdAt as shipmentCreatedAt
      FROM complaints c
      LEFT JOIN users u ON c.resolvedBy = u.id
      LEFT JOIN shipments s ON c.shipmentId = s.id
      WHERE 1=1
    `
    const params = []

    if (status) {
      query += " AND c.status = ?"
      params.push(status)
    }

    query += ` ORDER BY c.createdAt DESC LIMIT ${limitNum} OFFSET ${offset}`

    const [complaints] = await pool.execute(query, params)

    // Get total count
    let countQuery = "SELECT COUNT(*) as total FROM complaints WHERE 1=1"
    const countParams = []
    if (status) {
      countQuery += " AND status = ?"
      countParams.push(status)
    }
    const [countResult] = await pool.execute(countQuery, countParams)
    const total = countResult[0]?.total || 0

    res.status(200).json({
      success: true,
      complaints,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (error) {
    console.error("Error fetching complaints:", error)
    console.error("Error details:", error.message)
    console.error("Error stack:", error.stack)
    res.status(500).json({ 
      message: "Server error while fetching complaints.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    })
  }
}

/**
 * Get a single complaint by ID with messages (admin or owner)
 */
export const getComplaintById = async (req, res) => {
  try {
    const { complaintId } = req.params
    const userId = req.user.id

    const [complaints] = await pool.execute(
      `SELECT 
        c.*,
        u.fullName as resolvedByName,
        s.id as shipmentId,
        s.pickupState,
        s.pickupLga,
        s.destinationState,
        s.destinationLga,
        s.status as shipmentStatus,
        s.createdAt as shipmentCreatedAt
      FROM complaints c
      LEFT JOIN users u ON c.resolvedBy = u.id
      LEFT JOIN shipments s ON c.shipmentId = s.id
      WHERE c.id = ?`,
      [complaintId]
    )

    if (complaints.length === 0) {
      return res.status(404).json({ message: "Complaint not found." })
    }

    const complaint = complaints[0]

    // Check permission
    if (complaint.userId !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "You don't have permission to view this complaint." })
    }

    // Get all messages
    const [messages] = await pool.execute(
      `SELECT * FROM complaint_messages 
       WHERE complaintId = ? 
       ORDER BY createdAt ASC`,
      [complaintId]
    )

    res.status(200).json({
      success: true,
      complaint: {
        ...complaint,
        messages,
      },
    })
  } catch (error) {
    console.error("Error fetching complaint:", error)
    res.status(500).json({ message: "Server error while fetching complaint." })
  }
}

/**
 * Update complaint status (admin only)
 */
export const updateComplaint = async (req, res) => {
  try {
    const adminId = req.user.id
    const { complaintId } = req.params
    const { status } = req.body

    if (!status) {
      return res.status(400).json({ message: "Status is required." })
    }

    const validStatuses = ["pending", "in_progress", "resolved", "closed"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status." })
    }

    // Check if complaint exists
    const [complaints] = await pool.execute("SELECT * FROM complaints WHERE id = ?", [complaintId])
    if (complaints.length === 0) {
      return res.status(404).json({ message: "Complaint not found." })
    }

    // Update complaint
    const updateFields = ["status = ?"]
    const params = [status]

    if (status === "resolved" || status === "closed") {
      updateFields.push("resolvedBy = ?", "resolvedAt = NOW()")
      params.push(adminId)
    } else {
      updateFields.push("resolvedBy = NULL", "resolvedAt = NULL")
    }

    params.push(complaintId)

    await pool.execute(
      `UPDATE complaints SET ${updateFields.join(", ")} WHERE id = ?`,
      params
    )

    res.status(200).json({
      success: true,
      message: "Complaint updated successfully.",
    })
  } catch (error) {
    console.error("Error updating complaint:", error)
    res.status(500).json({ message: "Server error while updating complaint." })
  }
}

/**
 * Add a reply/message to a complaint (admin or user)
 */
export const addComplaintMessage = async (req, res) => {
  try {
    const senderId = req.user.id
    const { complaintId } = req.params
    const { message } = req.body

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required." })
    }

    // Check if complaint exists
    const [complaints] = await pool.execute("SELECT * FROM complaints WHERE id = ?", [complaintId])
    if (complaints.length === 0) {
      return res.status(404).json({ message: "Complaint not found." })
    }

    const complaint = complaints[0]

    // Check if user has permission (either the owner or admin)
    if (complaint.userId !== senderId && req.user.role !== "admin") {
      return res.status(403).json({ message: "You don't have permission to reply to this complaint." })
    }

    // Get sender details
    const [userRows] = await pool.execute(
      "SELECT fullName, role FROM users WHERE id = ?",
      [senderId]
    )

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found." })
    }

    const sender = userRows[0]

    // Insert message
    const [result] = await pool.execute(
      `INSERT INTO complaint_messages (complaintId, senderId, senderRole, senderName, message)
       VALUES (?, ?, ?, ?, ?)`,
      [complaintId, senderId, sender.role, sender.fullName, message.trim()]
    )

    // Update complaint status if it was resolved/closed and someone replies
    if (complaint.status === "resolved" || complaint.status === "closed") {
      await pool.execute(
        "UPDATE complaints SET status = 'in_progress', resolvedBy = NULL, resolvedAt = NULL WHERE id = ?",
        [complaintId]
      )
    } else if (complaint.status === "pending") {
      await pool.execute(
        "UPDATE complaints SET status = 'in_progress' WHERE id = ?",
        [complaintId]
      )
    }

    res.status(201).json({
      success: true,
      message: "Reply added successfully.",
      messageId: result.insertId,
    })
  } catch (error) {
    console.error("Error adding complaint message:", error)
    res.status(500).json({ message: "Server error while adding reply." })
  }
}

/**
 * Get all messages for a complaint
 */
export const getComplaintMessages = async (req, res) => {
  try {
    const { complaintId } = req.params
    const userId = req.user.id

    // Check if complaint exists and user has permission
    const [complaints] = await pool.execute("SELECT * FROM complaints WHERE id = ?", [complaintId])
    if (complaints.length === 0) {
      return res.status(404).json({ message: "Complaint not found." })
    }

    const complaint = complaints[0]

    // Check permission
    if (complaint.userId !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "You don't have permission to view this complaint." })
    }

    // Get all messages
    const [messages] = await pool.execute(
      `SELECT * FROM complaint_messages 
       WHERE complaintId = ? 
       ORDER BY createdAt ASC`,
      [complaintId]
    )

    res.status(200).json({
      success: true,
      messages,
    })
  } catch (error) {
    console.error("Error fetching complaint messages:", error)
    res.status(500).json({ message: "Server error while fetching messages." })
  }
}

/**
 * Get complaint statistics (admin only)
 */
export const getComplaintStats = async (req, res) => {
  try {
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
      FROM complaints`
    )

    res.status(200).json({
      success: true,
      stats: {
        total: stats[0]?.total || 0,
        pending: stats[0]?.pending || 0,
        in_progress: stats[0]?.in_progress || 0,
        resolved: (stats[0]?.resolved || 0) + (stats[0]?.closed || 0),
      },
    })
  } catch (error) {
    console.error("Error fetching complaint stats:", error)
    res.status(500).json({ message: "Server error while fetching complaint stats." })
  }
}

/**
 * Get user's own complaints with messages
 */
export const getMyComplaints = async (req, res) => {
  try {
    const userId = req.user.id

    const [complaints] = await pool.execute(
      `SELECT 
        c.*,
        u.fullName as resolvedByName,
        s.id as shipmentId,
        s.pickupState,
        s.pickupLga,
        s.destinationState,
        s.destinationLga,
        s.status as shipmentStatus,
        s.createdAt as shipmentCreatedAt
      FROM complaints c
      LEFT JOIN users u ON c.resolvedBy = u.id
      LEFT JOIN shipments s ON c.shipmentId = s.id
      WHERE c.userId = ?
      ORDER BY c.createdAt DESC`,
      [userId]
    )

    // Get messages for each complaint
    for (let complaint of complaints) {
      const [messages] = await pool.execute(
        `SELECT * FROM complaint_messages 
         WHERE complaintId = ? 
         ORDER BY createdAt ASC`,
        [complaint.id]
      )
      complaint.messages = messages
    }

    res.status(200).json({
      success: true,
      complaints,
    })
  } catch (error) {
    console.error("Error fetching user complaints:", error)
    res.status(500).json({ message: "Server error while fetching complaints." })
  }
}

