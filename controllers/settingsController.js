import pool from "../config/db.js"

/**
 * Get system setting value
 */
export const getSetting = async (req, res) => {
  try {
    const { key } = req.params

    const [rows] = await pool.execute(
      "SELECT setting_key, setting_value, description, updatedAt FROM system_settings WHERE setting_key = ?",
      [key]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Setting not found"
      })
    }

    res.json({
      success: true,
      setting: rows[0]
    })
  } catch (error) {
    console.error("Error getting setting:", error)
    res.status(500).json({
      success: false,
      message: "Server error getting setting",
      error: error.message
    })
  }
}

/**
 * Get diesel rate (public endpoint)
 */
export const getDieselRate = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'diesel_rate_per_liter'"
    )

    const dieselRate = rows.length > 0 ? parseFloat(rows[0].setting_value) : 1200

    res.json({
      success: true,
      dieselRate: dieselRate
    })
  } catch (error) {
    console.error("Error getting diesel rate:", error)
    // Return default value if error
    res.json({
      success: true,
      dieselRate: 1200
    })
  }
}

/**
 * Update system setting (admin only)
 */
export const updateSetting = async (req, res) => {
  try {
    const { key } = req.params
    const { value, description } = req.body
    const userId = req.user.id

    if (!value) {
      return res.status(400).json({
        success: false,
        message: "Setting value is required"
      })
    }

    // Check if setting exists
    const [existing] = await pool.execute(
      "SELECT id FROM system_settings WHERE setting_key = ?",
      [key]
    )

    if (existing.length === 0) {
      // Create new setting
      await pool.execute(
        "INSERT INTO system_settings (setting_key, setting_value, description, updatedBy) VALUES (?, ?, ?, ?)",
        [key, value, description || null, userId]
      )
    } else {
      // Update existing setting
      await pool.execute(
        "UPDATE system_settings SET setting_value = ?, description = ?, updatedBy = ? WHERE setting_key = ?",
        [value, description || null, userId, key]
      )
    }

    // Get updated setting
    const [updated] = await pool.execute(
      "SELECT setting_key, setting_value, description, updatedAt FROM system_settings WHERE setting_key = ?",
      [key]
    )

    res.json({
      success: true,
      message: "Setting updated successfully",
      setting: updated[0]
    })
  } catch (error) {
    console.error("Error updating setting:", error)
    res.status(500).json({
      success: false,
      message: "Server error updating setting",
      error: error.message
    })
  }
}

/**
 * Update diesel rate (admin only)
 */
export const updateDieselRate = async (req, res) => {
  try {
    const { dieselRate } = req.body
    const userId = req.user.id

    if (!dieselRate || isNaN(parseFloat(dieselRate)) || parseFloat(dieselRate) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid diesel rate is required (must be a positive number)"
      })
    }

    const rateValue = parseFloat(dieselRate).toString()

    // Check if setting exists
    const [existing] = await pool.execute(
      "SELECT id FROM system_settings WHERE setting_key = 'diesel_rate_per_liter'"
    )

    if (existing.length === 0) {
      // Create new setting
      await pool.execute(
        "INSERT INTO system_settings (setting_key, setting_value, description, updatedBy) VALUES (?, ?, ?, ?)",
        ['diesel_rate_per_liter', rateValue, 'Diesel cost per liter in Naira', userId]
      )
    } else {
      // Update existing setting
      await pool.execute(
        "UPDATE system_settings SET setting_value = ?, updatedBy = ? WHERE setting_key = 'diesel_rate_per_liter'",
        [rateValue, userId]
      )
    }

    res.json({
      success: true,
      message: "Diesel rate updated successfully",
      dieselRate: parseFloat(rateValue)
    })
  } catch (error) {
    console.error("Error updating diesel rate:", error)
    res.status(500).json({
      success: false,
      message: "Server error updating diesel rate",
      error: error.message
    })
  }
}

