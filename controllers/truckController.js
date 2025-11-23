import {
  createTruck,
  getTruckById,
  getTrucksByFleetManagerId,
  getTrucksByDriverId,
  updateTruck,
  deleteTruck,
  checkPlateNumberExists,
} from "../models/Truck.js"

/**
 * Create a new truck
 */
export const createTruckController = async (req, res) => {
  try {
    const userId = req.user.id
    const { plateNumber, vehicleType, vehicleModel, vehicleYear, capacity, driverName, driverPhone, driverLicense, vehicleReg, quantity, driverId } = req.body

    if (!plateNumber || !vehicleType) {
      return res.status(400).json({ message: "Plate number and vehicle type are required." })
    }

    // Check if plate number already exists for this fleet manager (only check base plate number)
    const plateExists = await checkPlateNumberExists(plateNumber, userId)
    if (plateExists) {
      return res.status(409).json({ message: "A truck with this plate number already exists in your fleet." })
    }

    // If driverId is provided, verify it belongs to this fleet manager
    if (driverId) {
      const { getDriverById } = await import("../models/Driver.js")
      const driver = await getDriverById(driverId)
      if (!driver || driver.fleetManagerId !== userId) {
        return res.status(403).json({ message: "Driver not found or does not belong to you." })
      }
    }

    const truckId = await createTruck({
      fleetManagerId: userId,
      plateNumber,
      vehicleType,
      vehicleModel,
      vehicleYear,
      capacity,
      driverName,
      driverPhone,
      driverLicense,
      vehicleReg,
      quantity: quantity || 1,
      driverId: driverId || null,
    })

    // If multiple trucks were created, return the first one
    const truckIdToReturn = Array.isArray(truckId) ? truckId[0] : truckId
    const truck = await getTruckById(truckIdToReturn)

    res.status(201).json({
      message: Array.isArray(truckId) ? `${truckId.length} trucks added successfully.` : "Truck added successfully.",
      truck,
      truckIds: Array.isArray(truckId) ? truckId : [truckId],
    })
  } catch (error) {
    console.error("Error creating truck:", error)
    res.status(500).json({ message: "Server error during truck creation." })
  }
}

/**
 * Get all trucks for the authenticated fleet manager
 */
export const getMyTrucks = async (req, res) => {
  try {
    const userId = req.user.id
    const { limit = 50, offset = 0 } = req.query

    const trucks = await getTrucksByFleetManagerId(userId, limit, offset)

    res.status(200).json({
      success: true,
      trucks,
      count: trucks.length,
    })
  } catch (error) {
    console.error("Error fetching trucks:", error)
    res.status(500).json({ message: "Server error during trucks fetch." })
  }
}

/**
 * Get a single truck by ID
 */
export const getTruck = async (req, res) => {
  try {
    const userId = req.user.id
    const { truckId } = req.params

    const truck = await getTruckById(truckId)

    if (!truck) {
      return res.status(404).json({ message: "Truck not found." })
    }

    // Verify the truck belongs to this fleet manager
    if (truck.fleetManagerId !== userId) {
      return res.status(403).json({ message: "You don't have permission to access this truck." })
    }

    res.status(200).json({
      success: true,
      truck,
    })
  } catch (error) {
    console.error("Error fetching truck:", error)
    res.status(500).json({ message: "Server error during truck fetch." })
  }
}

/**
 * Update a truck
 */
export const updateTruckController = async (req, res) => {
  try {
    const userId = req.user.id
    const { truckId } = req.params
    const { plateNumber, vehicleType, vehicleModel, vehicleYear, capacity, driverName, driverPhone, driverLicense, vehicleReg, status, driverId } = req.body

    if (!plateNumber || !vehicleType) {
      return res.status(400).json({ message: "Plate number and vehicle type are required." })
    }

    // Check if plate number already exists for another truck
    const plateExists = await checkPlateNumberExists(plateNumber, userId, truckId)
    if (plateExists) {
      return res.status(409).json({ message: "A truck with this plate number already exists in your fleet." })
    }

    // If driverId is provided, verify it belongs to this fleet manager
    if (driverId) {
      const { getDriverById } = await import("../models/Driver.js")
      const driver = await getDriverById(driverId)
      if (!driver || driver.fleetManagerId !== userId) {
        return res.status(403).json({ message: "Driver not found or does not belong to you." })
      }
    }

    const updated = await updateTruck(truckId, userId, {
      plateNumber,
      vehicleType,
      vehicleModel,
      vehicleYear,
      capacity,
      driverName,
      driverPhone,
      driverLicense,
      vehicleReg,
      status,
      driverId: driverId || null, // Allow setting driverId to null to unassign
    })

    if (!updated) {
      return res.status(404).json({ message: "Truck not found or you don't have permission to update it." })
    }

    const truck = await getTruckById(truckId)

    res.status(200).json({
      message: "Truck updated successfully.",
      truck,
    })
  } catch (error) {
    console.error("Error updating truck:", error)
    res.status(500).json({ message: "Server error during truck update." })
  }
}

/**
 * Delete a truck
 */
export const deleteTruckController = async (req, res) => {
  try {
    const userId = req.user.id
    const { truckId } = req.params

    const deleted = await deleteTruck(truckId, userId)

    if (!deleted) {
      return res.status(404).json({ message: "Truck not found or you don't have permission to delete it." })
    }

    res.status(200).json({
      message: "Truck deleted successfully.",
    })
  } catch (error) {
    console.error("Error deleting truck:", error)
    res.status(500).json({ message: "Server error during truck deletion." })
  }
}

/**
 * Get trucks assigned to a driver (for driver dashboard)
 */
export const getMyAssignedTrucks = async (req, res) => {
  try {
    const driverId = req.user.id
    const userRole = req.user.role

    // Only drivers can access this endpoint
    if (userRole !== "driver") {
      return res.status(403).json({ message: "Only drivers can access this endpoint" })
    }

    const trucks = await getTrucksByDriverId(driverId)

    res.status(200).json({
      success: true,
      trucks,
      count: trucks.length,
    })
  } catch (error) {
    console.error("Error fetching assigned trucks:", error)
    res.status(500).json({ message: "Server error during trucks fetch." })
  }
}

