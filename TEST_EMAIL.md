# Email Troubleshooting Guide

## 🔍 Check Render Logs

After deploying, check your Render logs to see:
1. If the email verification passed
2. What the actual error message is when sending email

## 🧪 Test Email Sending

### 1. Test Forgot Password

```bash
curl -X POST https://holage-backend.onrender.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@example.com"}'
```

### 2. Check Render Logs

In your Render dashboard → Logs, you should see:
- `📧 Attempting to send password reset email to: ...`
- Then either:
  - `✅ Password reset email sent successfully` (Success!)
  - `❌ Forgot password error: ...` (Error details)

## 🐛 Common Issues

### Issue 1: "Connection timeout"
**Cause:** Render blocks SMTP ports  
**Solution:** 
- Use SendGrid, Mailgun, or Gmail App Password
- Or use the verification skip I already added

### Issue 2: "Invalid credentials"
**Cause:** Wrong username/password  
**Solution:** 
- Double-check your SMTP credentials in Render environment variables
- For Gmail: Use App Password, not regular password

### Issue 3: "Authentication failed"
**Cause:** SMTP server authentication issue  
**Solution:**
- Check if your custom SMTP server allows connections from Render's IPs
- Try a different SMTP provider

## 📊 What You Should See in Logs

### ✅ Success:
```
📧 Attempting to send password reset email to: test@example.com
Password reset email sent to test@example.com
✅ Password reset email sent successfully to: test@example.com
```

### ❌ Error:
```
📧 Attempting to send password reset email to: test@example.com
Error sending password reset email to test@example.com: Connection timeout
❌ Forgot password error: Error: Connection timeout
Error details: Connection timeout
```

## 🚀 Quick Fix

If you're using a custom SMTP server and it's timing out:

1. **Switch to SendGrid** (Recommended):
   - Sign up: https://sendgrid.com
   - Get API key
   - Update Render env vars:
     ```
     EMAIL_HOST=smtp.sendgrid.net
     EMAIL_PORT=587
     EMAIL_SECURE=false
     EMAIL_USER=apikey
     EMAIL_PASS=your_sendgrid_api_key
     ```

2. **Or use Gmail**:
   - Create App Password: https://myaccount.google.com/apppasswords
   - Update Render env vars:
     ```
     EMAIL_HOST=smtp.gmail.com
     EMAIL_PORT=587
     EMAIL_SECURE=false
     EMAIL_USER=your@gmail.com
     EMAIL_PASS=your_app_password
     ```

## 📝 Next Steps

1. Check Render logs for the actual error
2. If it's a timeout, switch to SendGrid or Gmail
3. If it's credentials, double-check your env vars
4. Share the error from logs and I can help fix it!
