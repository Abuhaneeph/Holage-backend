import multer from "multer"
import { v2 as cloudinary } from "cloudinary"
import { updateKycInfo, findUserById } from "../models/User.js"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Multer memory storage configuration for Cloudinary
const storage = multer.memoryStorage()

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/
    const mimetype = filetypes.test(file.mimetype)
    const extname = filetypes.test(file.originalname.split('.').pop().toLowerCase())

    if (mimetype && extname) {
      return cb(null, true)
    }
    cb(new Error("Error: File upload only supports images (jpeg, jpg, png) and PDFs!"))
  },
}).fields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "driverLicense", maxCount: 1 },
  { name: "vehicleReg", maxCount: 1 },
  { name: "utilityBill", maxCount: 1 },
  { name: "passportPhoto", maxCount: 1 },
])

// Helper function to upload file to Cloudinary
const uploadToCloudinary = (buffer, originalname, folder = 'Holage/kyc-documents') => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: folder,
      public_id: `${folder.replace('/', '-')}-${Date.now()}-${originalname.split('.')[0]}`,
      resource_type: 'auto', // Automatically detect file type (image/pdf)
    }

    cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error)
        } else {
          resolve({
            url: result.secure_url,
            public_id: result.public_id
          })
        }
      }
    ).end(buffer)
  })
}

export const submitKyc = (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Multer error: ${err.message}` })
    } else if (err) {
      return res.status(400).json({ message: err.message })
    }

    const userId = req.user.id // From auth middleware
    const { phone, address, nin, plateNumber, vehicleType } = req.body

    // Basic validation for compulsory personal info fields
    if (!phone || !address || !nin) {
      return res.status(400).json({ message: "Phone, address, and NIN are compulsory." })
    }

    try {
      // Upload files to Cloudinary
      const uploadPromises = []
      const fileFields = ['profilePhoto', 'driverLicense', 'vehicleReg', 'utilityBill', 'passportPhoto']
      const uploadedFiles = {}

      for (const field of fileFields) {
        if (req.files && req.files[field] && req.files[field][0]) {
          const file = req.files[field][0]
          uploadPromises.push(
            uploadToCloudinary(file.buffer, file.originalname, `Holage/kyc-${field}`)
              .then(result => {
                uploadedFiles[field] = {
                  url: result.url,
                  public_id: result.public_id
                }
              })
              .catch(error => {
                console.error(`Error uploading ${field}:`, error)
                throw new Error(`Failed to upload ${field}`)
              })
          )
        }
      }

      // Wait for all uploads to complete
      await Promise.all(uploadPromises)

      const kycData = {
        phone: phone || null,
        address: address || null,
        nin: nin || null,
        profilePhoto: uploadedFiles.profilePhoto?.url || null,
        profilePhotoPublicId: uploadedFiles.profilePhoto?.public_id || null,
        driverLicense: uploadedFiles.driverLicense?.url || null,
        driverLicensePublicId: uploadedFiles.driverLicense?.public_id || null,
        vehicleReg: uploadedFiles.vehicleReg?.url || null,
        vehicleRegPublicId: uploadedFiles.vehicleReg?.public_id || null,
        utilityBill: uploadedFiles.utilityBill?.url || null,
        utilityBillPublicId: uploadedFiles.utilityBill?.public_id || null,
        passportPhoto: uploadedFiles.passportPhoto?.url || null,
        passportPhotoPublicId: uploadedFiles.passportPhoto?.public_id || null,
        kycStatus: "pending", // Set initial KYC status to pending
      }

      // Add trucker-specific fields if role is trucker
      const user = await findUserById(userId)
      if (user && user.role === "trucker") {
        if (!plateNumber || !vehicleType) {
          return res.status(400).json({ message: "Plate number and vehicle type are required for truckers." })
        }
        kycData.plateNumber = plateNumber || null
        kycData.vehicleType = vehicleType || null
      } else {
        // Ensure these fields are null for non-truckers
        kycData.plateNumber = null
        kycData.vehicleType = null
      }

      await updateKycInfo(userId, kycData)
      res.status(200).json({ 
        message: "KYC information submitted successfully for review.", 
        kycStatus: "pending",
        uploadedFiles: Object.keys(uploadedFiles)
      })

    } catch (error) {
      console.error("Error during KYC submission:", error)
      
      // If there was an error after some files were uploaded, you might want to clean them up
      // This is optional but good practice
      try {
        const uploadedFiles = Object.values(uploadedFiles || {})
        for (const file of uploadedFiles) {
          if (file.public_id) {
            await cloudinary.uploader.destroy(file.public_id)
          }
        }
      } catch (cleanupError) {
        console.error("Error cleaning up uploaded files:", cleanupError)
      }

      if (error.message.includes('Failed to upload')) {
        return res.status(500).json({ message: "File upload failed", error: error.message })
      }
      
      return res.status(500).json({ message: "Server error during KYC submission", error: error.message })
    }
  })
}

export const getKycStatus = async (req, res) => {
  const userId = req.user.id
  try {
    const user = await findUserById(userId)
    if (!user) return res.status(404).json({ message: "User not found" })
    res.status(200).json({ kycStatus: user.kycStatus })
  } catch (error) {
    console.error("Error fetching KYC status:", error)
    res.status(500).json({ message: "Server error fetching KYC status." })
  }
}

// Optional: Helper function to delete files from Cloudinary (useful for cleanup)
export const deleteKycFiles = async (publicIds) => {
  try {
    const deletePromises = publicIds.map(publicId => 
      cloudinary.uploader.destroy(publicId)
    )
    await Promise.all(deletePromises)
    return { success: true }
  } catch (error) {
    console.error("Error deleting files from Cloudinary:", error)
    return { success: false, error: error.message }
  }
}