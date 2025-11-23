import multer from "multer"
import { v2 as cloudinary } from "cloudinary"
import pool from "../config/db.js"
import { updateKycInfo, findUserById, updateUserBankAccount } from "../models/User.js"

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
    const { phone, address, nin, plateNumber, vehicleType, bankAccountNumber, bankCode, bankName } = req.body

    // Basic validation for compulsory personal info fields
    if (!phone || !address || !nin) {
      return res.status(400).json({ message: "Phone, address, and NIN are compulsory." })
    }

    // Bank account details are optional for all roles
    // No validation required - users can add/update later via profile

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

      // Update bank account details if provided (for all roles - optional)
      if (bankAccountNumber && bankCode) {
        await updateUserBankAccount(userId, {
          bankAccountNumber,
          bankCode,
          bankName: bankName || null
        })
      }

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
      bankAccountNumber: user.bankAccountNumber || null,
      bankCode: user.bankCode || null,
      bankName: user.bankName || null,
      role: user.role
    }
    
    res.status(200).json({ success: true, documents })
  } catch (error) {
    console.error("Error fetching KYC documents:", error)
    res.status(500).json({ message: "Server error fetching KYC documents." })
  }
}

/**
 * Update bank account details (for profile page updates)
 */
export const updateBankAccount = async (req, res) => {
  try {
    const userId = req.user.id
    const { bankAccountNumber, bankCode, bankName } = req.body || {}

    let finalBankCode = bankCode

    // Validate that if any bank field is provided, account number and code are required
    if (bankAccountNumber || bankCode || bankName) {
      if (!bankAccountNumber) {
        return res.status(400).json({ 
          message: "Account number is required when updating bank details." 
        })
      }

      // If bankName is provided but bankCode is not, try to fetch from Paystack
      if (bankName && !bankCode) {
        try {
          const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
          if (PAYSTACK_SECRET_KEY) {
            const axios = (await import('axios')).default
            const banksResponse = await axios.get(
              'https://api.paystack.co/bank?country=nigeria',
              {
                headers: {
                  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                  'Content-Type': 'application/json'
                }
              }
            )

            if (banksResponse.data.status && banksResponse.data.data) {
              const bank = banksResponse.data.data.find(
                b => b.name.toLowerCase() === bankName.toLowerCase() || 
                     b.slug.toLowerCase() === bankName.toLowerCase() ||
                     b.name.toLowerCase().includes(bankName.toLowerCase()) ||
                     bankName.toLowerCase().includes(b.name.toLowerCase())
              )
              if (bank) {
                finalBankCode = bank.code
                console.log(`✅ Found bank code for ${bankName}: ${finalBankCode}`)
              }
            }
          }
        } catch (fetchError) {
          console.error('Error fetching bank code from Paystack:', fetchError.message)
          // Continue with validation - user must provide bank code manually
        }
      }

      if (!finalBankCode) {
        return res.status(400).json({ 
          message: "Bank code is required. Please provide the bank code or ensure the bank name is recognized by Paystack." 
        })
      }

      // Validate bank code format (should be numeric, 3-10 digits to support all Paystack bank codes)
      // OPay uses 999992 (6 digits), so we allow 3-10 digits
      if (!/^\d{3,10}$/.test(finalBankCode)) {
        return res.status(400).json({ 
          message: "Invalid bank code format. Bank code must be numeric (3-10 digits)." 
        })
      }

      // Validate account number format (should be 10 digits, but some banks may have different lengths)
      // Allow 8-12 digits to accommodate different bank account number formats
      if (!/^\d{8,12}$/.test(bankAccountNumber)) {
        return res.status(400).json({ 
          message: "Invalid account number format. Account number must be 8-12 digits." 
        })
      }
    }

    // Update bank account details
    await updateUserBankAccount(userId, {
      bankAccountNumber: bankAccountNumber || null,
      bankCode: finalBankCode || null,
      bankName: bankName || null
    })

    res.status(200).json({ 
      success: true,
      message: "Bank account details updated successfully" 
    })
  } catch (error) {
    console.error("Error updating bank account:", error)
    res.status(500).json({ message: "Server error updating bank account details." })
  }
}
 
/**
 * Get all KYC submissions (admin only)
 */
export const getAllKycSubmissions = async (req, res) => {
  try {
    const { status } = req.query
    let query = `
      SELECT 
        id,
        fullName,
        email,
        role,
        phone,
        address,
        nin,
        profilePhoto,
        driverLicense,
        vehicleReg,
        utilityBill,
        plateNumber,
        vehicleType,
        kycStatus,
        createdAt
      FROM users
      WHERE kycStatus IS NOT NULL
    `
    const params = []

    if (status) {
      query += " AND kycStatus = ?"
      params.push(status)
    }

    query += " ORDER BY createdAt DESC"

    const [rows] = await pool.execute(query, params)

    res.status(200).json({
      success: true,
      submissions: rows,
    })
  } catch (error) {
    console.error("Error fetching KYC submissions:", error)
    res.status(500).json({ message: "Server error while fetching KYC submissions." })
  }
}

/**
 * Get a single KYC submission by user ID (admin only)
 */
export const getKycSubmissionById = async (req, res) => {
  try {
    const { userId } = req.params

    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    const submission = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
      nin: user.nin,
      profilePhoto: user.profilePhoto,
      driverLicense: user.driverLicense,
      vehicleReg: user.vehicleReg,
      utilityBill: user.utilityBill,
      plateNumber: user.plateNumber,
      vehicleType: user.vehicleType,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt,
    }

    res.status(200).json({
      success: true,
      submission,
    })
  } catch (error) {
    console.error("Error fetching KYC submission:", error)
    res.status(500).json({ message: "Server error while fetching KYC submission." })
  }
}

/**
 * Approve or reject KYC submission (admin only)
 */
export const updateKycStatus = async (req, res) => {
  try {
    const adminId = req.user.id
    const { userId } = req.params
    const { status, rejectionReason } = req.body

    if (!status) {
      return res.status(400).json({ message: "Status is required." })
    }

    const validStatuses = ["pending", "approved", "rejected"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status." })
    }

    // Check if user exists
    const user = await findUserById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    // Update KYC status
    await pool.execute(
      "UPDATE users SET kycStatus = ? WHERE id = ?",
      [status, userId]
    )

    res.status(200).json({
      success: true,
      message: `KYC ${status} successfully.`,
    })
  } catch (error) {
    console.error("Error updating KYC status:", error)
    res.status(500).json({ message: "Server error while updating KYC status." })
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