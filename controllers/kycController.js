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
      const fileFields = ['profilePhoto', 'driverLicense', 'vehicleReg', 'utilityBill']
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

      // Fetch existing user data first to preserve documents not being updated
      const user = await findUserById(userId)
      
      const kycData = {
        phone: phone || user.phone || null,
        address: address || user.address || null,
        nin: nin || user.nin || null,
        // Only update document fields if new files are uploaded, otherwise keep existing
        profilePhoto: uploadedFiles.profilePhoto?.url || user.profilePhoto || null,
        profilePhotoPublicId: uploadedFiles.profilePhoto?.public_id || user.profilePhotoPublicId || null,
        driverLicense: uploadedFiles.driverLicense?.url || user.driverLicense || null,
        driverLicensePublicId: uploadedFiles.driverLicense?.public_id || user.driverLicensePublicId || null,
        vehicleReg: uploadedFiles.vehicleReg?.url || user.vehicleReg || null,
        vehicleRegPublicId: uploadedFiles.vehicleReg?.public_id || user.vehicleRegPublicId || null,
        utilityBill: uploadedFiles.utilityBill?.url || user.utilityBill || null,
        utilityBillPublicId: uploadedFiles.utilityBill?.public_id || user.utilityBillPublicId || null,
        kycStatus: user.kycStatus || "pending", // Keep existing status or set to pending
      }

      // Add trucker-specific fields if role is trucker
      if (user && user.role === "trucker") {
        // For truckers, preserve existing values if not provided
        kycData.plateNumber = plateNumber || user.plateNumber || null
        kycData.vehicleType = vehicleType || user.vehicleType || null
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

export const getKycDocuments = async (req, res) => {
  const userId = req.user.id
  try {
    const user = await findUserById(userId)
    if (!user) return res.status(404).json({ message: "User not found" })
    
    const documents = {
      profilePhoto: user.profilePhoto || null,
      utilityBill: user.utilityBill || null,
      driverLicense: user.driverLicense || null,
      vehicleReg: user.vehicleReg || null,
      kycStatus: user.kycStatus || "pending",
      phone: user.phone || null,
      address: user.address || null,
      nin: user.nin || null,
      plateNumber: user.plateNumber || null,
      vehicleType: user.vehicleType || null,
      role: user.role
    }
    
    res.status(200).json({ success: true, documents })
  } catch (error) {
    console.error("Error fetching KYC documents:", error)
    res.status(500).json({ message: "Server error fetching KYC documents." })
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