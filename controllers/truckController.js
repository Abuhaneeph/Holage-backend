import {
  createTruck,
  getTruckById,
  getTrucksByFleetManagerId,
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
    const { plateNumber, vehicleType, vehicleModel, vehicleYear, capacity, driverName, driverPhone, driverLicense, vehicleReg } = req.body

    if (!plateNumber || !vehicleType) {
      return res.status(400).json({ message: "Plate number and vehicle type are required." })
    }

    // Check if plate number already exists for this fleet manager
    const plateExists = await checkPlateNumberExists(plateNumber, userId)
    if (plateExists) {
      return res.status(409).json({ message: "A truck with this plate number already exists in your fleet." })
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
    })

    const truck = await getTruckById(truckId)

    res.status(201).json({
      message: "Truck added successfully.",
      truck,
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
    const { plateNumber, vehicleType, vehicleModel, vehicleYear, capacity, driverName, driverPhone, driverLicense, vehicleReg, status } = req.body

    if (!plateNumber || !vehicleType) {
      return res.status(400).json({ message: "Plate number and vehicle type are required." })
    }

    // Check if plate number already exists for another truck
    const plateExists = await checkPlateNumberExists(plateNumber, userId, truckId)
    if (plateExists) {
      return res.status(409).json({ message: "A truck with this plate number already exists in your fleet." })
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

