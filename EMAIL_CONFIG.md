# 📧 Email Configuration Guide for Render

## ⚠️ Important: Render SMTP Restrictions

**Render's Free/Hobby tiers may block SMTP connections (ports 25, 465, 587)**

If you're experiencing "Connection timeout" errors when sending emails on Render, you need to use one of these solutions:

---

## ✅ **Recommended Solutions**

### **Option 1: Gmail with App Password (Free) - RECOMMENDED**

Best for development and small projects.

#### Setup Steps:

1. **Enable 2-Factor Authentication on your Gmail account**
   - Go to: https://myaccount.google.com/security
   - Enable 2FA if not already enabled

2. **Create an App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other" device
   - Copy the 16-character password

3. **Add to Render Environment Variables:**
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=yourname@gmail.com
   EMAIL_PASS=your_app_password_here
   ```

#### Limitations:
- ⚠️ Gmail has a daily sending limit (~500 emails/day)
- ⚠️ May mark as spam for bulk emails

---

### **Option 2: SendGrid (Free Tier Available)**

Best for production apps. Free tier: 100 emails/day.

#### Setup Steps:

1. **Sign up at SendGrid**: https://sendgrid.com

2. **Create an API Key**
   - Go to: Settings → API Keys
   - Create a new key with "Mail Send" permissions
   - Copy the API key

3. **Add to Render Environment Variables:**
   ```
   EMAIL_HOST=smtp.sendgrid.net
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=apikey
   EMAIL_PASS=your_sendgrid_api_key_here
   ```

---

### **Option 3: Mailgun (Free Tier Available)**

Professional email service. Free tier: 5,000 emails/month for 3 months.

#### Setup Steps:

1. **Sign up at Mailgun**: https://www.mailgun.com

2. **Get SMTP credentials**
   - Go to: Sending → Domain Settings
   - Copy SMTP username and password

3. **Add to Render Environment Variables:**
   ```
   EMAIL_HOST=smtp.mailgun.org
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your_mailgun_smtp_username
   EMAIL_PASS=your_mailgun_smtp_password
   ```

---

### **Option 4: AWS SES (Pay-As-You-Go)**

Best for high-volume apps. Very cheap (around $0.10 per 1,000 emails).

#### Setup Steps:

1. **Create AWS SES account**
2. **Verify your domain**
3. **Get SMTP credentials**

4. **Add to Render Environment Variables:**
   ```
   EMAIL_HOST=email-smtp.REGION.amazonaws.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your_ses_smtp_username
   EMAIL_PASS=your_ses_smtp_password
   ```

---

## 🔧 **Verification**

After setting up your environment variables on Render:

1. **Restart your service** on Render
2. **Check the logs** - you should see:
   ```
   🔍 Verifying email configuration...
   ✅ Email service is ready to send emails
   ```

If you see errors, the logs will tell you what's wrong.

---

## 🧪 **Testing Locally**

1. Copy `.env` file to your local machine
2. Add your email credentials
3. Test with:
   ```bash
   curl -X POST http://localhost:4000/api/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

---

## ⚡ **Quick Fix: If Still Having Issues**

If you're still getting timeout errors after trying the above:

### **Increase Timeout Settings:**

Add these to your `.env` file (optional, already added in code):
```env
EMAIL_TIMEOUT=30000
```

Or use a different port:
```env
EMAIL_PORT=465
EMAIL_SECURE=true
```

---

## 📊 **Comparison Table**

| Service | Free Tier | Best For | Setup Difficulty |
|---------|-----------|----------|------------------|
| Gmail | ✅ Unlimited* | Development | ⭐ Easy |
| SendGrid | 100/day | Small apps | ⭐⭐ Medium |
| Mailgun | 5K/month | Medium apps | ⭐⭐ Medium |
| AWS SES | Pay-as-go | Large apps | ⭐⭐⭐ Hard |

*Gmail: ~500 emails/day before rate limiting

---

## 🆘 **Troubleshooting**

### Error: "Connection timeout"
- ✅ Try a different SMTP provider
- ✅ Check if Render is blocking the port
- ✅ Verify firewall settings

### Error: "Invalid credentials"
- ✅ Double-check your username/password
- ✅ For Gmail: Use App Password, not your regular password
- ✅ For SendGrid: Use "apikey" as username

### Error: "Authentication failed"
- ✅ Enable "Less secure app access" (Gmail) OR use App Password
- ✅ Check if 2FA is enabled (Gmail requires App Password with 2FA)

---

## 📝 **Current Configuration Check**

Your current settings (check on Render dashboard):
- ✅ Connection timeout: 10 seconds
- ✅ Greeting timeout: 5 seconds  
- ✅ Socket timeout: 10 seconds
- ✅ Automatic retry on failure

---

**Need Help?** Open an issue with your error message and we'll help you fix it! 🚀
