import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import randomstring from "randomstring"
import pool from "../config/db.js"
import {
  createUser,
  findUserByEmail,
  findUserByVerificationCode,
  verifyUser,
  updatePasswordResetToken,
  findUserByResetToken,
  findUserByResetCode, // Add this new function to your User model
  updatePassword,
} from "../models/User.js"
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/email.js"
import dotenv from "dotenv"

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET

export const register = async (req, res) => {
  const { fullName, email, password, role } = req.body

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required." })
  }

  try {
    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      return res.status(409).json({ message: "User with this email already exists." })
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    
    // Set expiration time (e.g., 10 minutes from now)
    const codeExpiration = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    const userId = await createUser(fullName, email, password, role, verificationCode, codeExpiration)

    await sendVerificationEmail(email, verificationCode)

    res.status(201).json({ 
      message: "Registration successful. Please check your email for the 6-digit verification code.", 
      userId 
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ message: "Server error during registration." })
  }
}

export const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." })
  }

  try {
    const user = await findUserByEmail(email)
    if (!user) {
      return res.status(404).json({ message: "User does not exist. Please sign up first." })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password. Please try again." })
    }

    if (!user.isVerified) {
      // Generate new verification code and resend
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
      
      // Update the user's verification code
      await pool.execute(
        "UPDATE users SET verificationToken = ? WHERE email = ?",
        [verificationCode, email]
      )
      
      // Send the new verification code
      await sendVerificationEmail(email, verificationCode)
      
      return res.status(403).json({ 
        message: "Please verify your email to log in. A new verification code has been sent to your email.",
        requiresVerification: true,
        email: user.email
      })
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "1h" })

    res.status(200).json({
      message: "Login successful.",
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, kycStatus: user.kycStatus },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Server error during login." })
  }
}

export const verifyEmail = async (req, res) => {
  const { code } = req.body // Get code from request body instead of query params

  if (!code) {
    return res.status(400).json({ message: "Verification code is required." })
  }

  // Validate that code is exactly 6 digits
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "Verification code must be exactly 6 digits." })
  }

  try {
    const user = await findUserByVerificationCode(code)
    
    if (!user) {
      return res.status(404).json({ message: "Invalid verification code." })
    }

    if (user.isVerified) {
      return res.status(200).json({ message: "Email already verified." })
    }

   
    // Verify the user and clear verification code
    await verifyUser(user.id)

     // Generate JWT token for authenticated session
    const authToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '30d' // or your preferred expiration
    })
    
    res.status(200).json({
      message: "Email verified successfully",
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: true
      }
    })
  } catch (error) {
    console.error("Email verification error:", error)
    res.status(500).json({ message: "Server error during email verification." })
  }
}

export const forgotPassword = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: "Email is required." })
  }

  try {
    const user = await findUserByEmail(email)
    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    // Generate a 6-digit numeric reset code
    const resetCode = randomstring.generate({ length: 6, charset: "numeric" })
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    console.log(`📧 Attempting to send password reset email to: ${email}`)
    
    // Store the code and its expiration (implement this function in your DB layer)
    await updatePasswordResetToken(email, resetCode, resetExpires)

    // Send the code via email (update the function accordingly)
    await sendPasswordResetEmail(email, resetCode)

    console.log(`✅ Password reset email sent successfully to: ${email}`)
    
    return res.status(200).json({ message: "Password reset code sent to your email." })
  } catch (error) {
    console.error("❌ Forgot password error:", error)
    console.error("Error details:", error.message)
    console.error("Stack trace:", error.stack)
    return res.status(500).json({ 
      message: "Server error during password reset request.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    })
  }
}

// NEW FUNCTION: Verify Reset Code
export const verifyResetCode = async (req, res) => {
  const { email, resetCode } = req.body

  if (!email || !resetCode) {
    return res.status(400).json({ message: "Email and reset code are required." })
  }

  // Validate that code is exactly 6 digits
  if (!/^\d{6}$/.test(resetCode)) {
    return res.status(400).json({ message: "Reset code must be exactly 6 digits." })
  }

  try {
    // Find user by email and check if the reset code matches and is not expired
    const user = await findUserByEmail(email)
    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    // Check if the reset code matches and is not expired
    if (user.resetPasswordToken != resetCode) {
      console.log('user.resetPasswordToken', user.resetPasswordToken , 'resetCode', resetCode)
      return res.status(400).json({ message: "Invalid reset code." })
    }

    if (!user.resetPasswordExpires || new Date() > user.resetPasswordExpires) {
      return res.status(400).json({ message: "Reset code has expired." })
    }

    // Generate a random 6-digit reset token for the next step
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString()
    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Update the user with the new reset token
    await updatePasswordResetToken(email, resetToken, tokenExpires)

    return res.status(200).json({ 
      message: "Reset code verified successfully.",
      resetToken: resetToken 
    })
  } catch (error) {
    console.error("Verify reset code error:", error)
    return res.status(500).json({ message: "Server error during reset code verification." })
  }
}

export const resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body // Changed from 'token' to 'resetToken' to match frontend

  if (!resetToken || !newPassword) {
    return res.status(400).json({ message: "Reset token and new password are required." })
  }

  // Add password validation
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters long." })
  }

  try {
    const user = await findUserByResetToken(resetToken)
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired password reset token." })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await updatePassword(user.id, hashedPassword)

    // Clear the reset token after successful password reset
    await updatePasswordResetToken(user.email, null, null)

    res.status(200).json({ message: "Password has been reset successfully." })
  } catch (error) {
    console.error("Reset password error:", error)
    res.status(500).json({ message: "Server error during password reset." })
  }
}

export const resendVerificationCode = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: "Email is required." })
  }

  try {
    const user = await findUserByEmail(email)
    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified." })
    }

    // Generate new 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const codeExpiration = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Update the user's verification code
    await pool.execute(
      "UPDATE users SET verificationToken = ? WHERE email = ?",
      [verificationCode, email]
    )

    // Send the new verification code via email
    await sendVerificationEmail(email, verificationCode)

    res.status(200).json({ message: "Verification code resent successfully." })
  } catch (error) {
    console.error("Resend verification error:", error)
    res.status(500).json({ message: "Server error while resending verification code." })
  }
}