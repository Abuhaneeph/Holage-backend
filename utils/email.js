import { Resend } from 'resend'
import dotenv from "dotenv"

dotenv.config()

// Initialize Resend with API key from environment
// Provide a default fallback to prevent crashes during development
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_demo_key'

if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY not found in .env file. Email functionality will not work until configured.')
}

const resend = new Resend(RESEND_API_KEY)

export const sendVerificationEmail = async (email, verificationCode) => {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Holage <onboarding@resend.dev>',
      to: email,
      subject: "Verify Your Email for Holage App",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1;">Holage App</h1>
          </div>
          
          <h2 style="color: #333;">Email Verification</h2>
          
          <p>Hello,</p>
          <p>Thank you for registering with Holage App. Please use the following 6-digit code to verify your email address:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #6366f1; font-size: 36px; letter-spacing: 8px; margin: 0;">${verificationCode}</h1>
          </div>
          
          <p><strong>This code will expire in 10 minutes.</strong></p>
          <p>If you did not register for this account, please ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error(`Error sending verification email to ${email}:`, error)
      throw error
    }

    console.log(`✅ Verification email sent to ${email}`)
    return data
  } catch (error) {
    console.error(`❌ Error sending verification email to ${email}:`, error)
    throw error
  }
}

export const sendPasswordResetEmail = async (email, token) => {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Holage <onboarding@resend.dev>',
      to: email,
      subject: "Password Reset for Holage App",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1;">Holage App</h1>
          </div>
          
          <h2 style="color: #333;">Reset Your Password</h2>
          
          <p>Hello,</p>
          <p>You have requested to reset your password for Holage App. Please use the following code to reset your password:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #6366f1; font-size: 36px; letter-spacing: 8px; margin: 0;">${token}</h1>
          </div>
          
          <p><strong>This code will expire in 15 minutes.</strong></p>
          <p>If you did not request a password reset, please ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error(`Error sending password reset email to ${email}:`, error)
      throw error
    }

    console.log(`✅ Password reset email sent to ${email}`)
    return data
  } catch (error) {
    console.error(`❌ Error sending password reset email to ${email}:`, error)
    throw error
  }
}

/**
 * Verify Resend email configuration
 * Call this on server startup to check if Resend is properly configured
 */
export const verifyEmailConnection = async () => {
  try {
    console.log("🔍 Verifying Resend email configuration...");
    
    // Check if RESEND_API_KEY is set
    if (!process.env.RESEND_API_KEY) {
      console.error(`❌ Missing RESEND_API_KEY environment variable`);
      return false;
    }
    
    // Resend doesn't require connection verification like SMTP
    // The API key will be validated when sending the first email
    console.log("✅ Resend email service is configured");
    console.log(`   From: ${process.env.RESEND_FROM_EMAIL || 'Holage <onboarding@resend.dev>'}`);
    return true;
  } catch (error) {
    console.error("❌ Email service verification failed:", error.message);
    return false;
  }
};


