import nodemailer from "nodemailer"
import dotenv from "dotenv"

dotenv.config()

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === "true", // Use 'true' for 465, 'false' for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
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


