import nodemailer from "nodemailer"
import dotenv from "dotenv"

dotenv.config()

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true", // Use 'true' for 465, 'false' for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Add connection timeout and retry options
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 5000, // 5 seconds
  socketTimeout: 10000, // 10 seconds
  debug: process.env.NODE_ENV === "development", // Enable debug logs in development
  logger: process.env.NODE_ENV === "development", // Enable logging in development
})

export const sendVerificationEmail = async (email, verificationCode) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
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
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log(`Verification email sent to ${email}`)
  } catch (error) {
    console.error(`Error sending verification email to ${email}:`, error)
    throw error // Re-throw to handle in calling function
  }

}

export const sendPasswordResetEmail = async (email, token) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
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
        
        <div style="text-align: center; margin: 20px 0;">
          <p style="background-color: #f3f4f6; color: #111827; padding: 12px 24px; border-radius: 6px; font-size: 18px; font-weight: bold; display: inline-block;">
            ${token}
          </p>
        </div>
        
        <p>This code will expire in 1 hour.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated message, please do not reply to this email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error(`Error sending password reset email to ${email}:`, error);
    throw error;
  }
};

/**
 * Verify email configuration and connection
 * Call this on server startup to check if email service is properly configured
 */
export const verifyEmailConnection = async () => {
  try {
    console.log("🔍 Verifying email configuration...");
    
    // Check if required environment variables are set
    const requiredEnvVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`❌ Missing email environment variables: ${missingVars.join(', ')}`);
      return false;
    }
    
    // Verify SMTP connection
    await transporter.verify();
    console.log("✅ Email service is ready to send emails");
    return true;
  } catch (error) {
    console.error("❌ Email service verification failed:", error.message);
    console.error("⚠️  Email functionality will not work until this is fixed");
    return false;
  }
};


