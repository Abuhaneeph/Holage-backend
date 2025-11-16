# Admin User Setup

## Default Admin Login Credentials

After running the admin creation script, you can log in with:

- **Email:** `admin@holage.com`
- **Password:** `admin123`

⚠️ **IMPORTANT:** Change the password after first login for security!

## How to Create Admin User

### Option 1: Using Node.js Script (Recommended)

Run the following command from the `holage-backend` directory:

```bash
npm run create-admin
```

This will:
- Create an admin user with email `admin@holage.com`
- Set password to `admin123` (hashed with bcrypt)
- Mark the user as verified and approved
- Display the login credentials

### Option 2: Using SQL Script

Run the SQL script directly in your MySQL client:

```bash
mysql -u your_username -p holage_db < scripts/create_admin_user.sql
```

### Option 3: Custom Admin User

You can customize the admin credentials by setting environment variables before running the script:

```bash
# Windows PowerShell
$env:ADMIN_EMAIL="your-admin@example.com"
$env:ADMIN_PASSWORD="your-secure-password"
$env:ADMIN_NAME="Your Admin Name"
npm run create-admin

# Linux/Mac
export ADMIN_EMAIL="your-admin@example.com"
export ADMIN_PASSWORD="your-secure-password"
export ADMIN_NAME="Your Admin Name"
npm run create-admin
```

## Admin Dashboard Access

Once the admin user is created:

1. Go to the login page
2. Enter the admin email and password
3. You will be automatically redirected to the Admin Dashboard
4. From there, you can:
   - View all customer complaints
   - Manage complaint statuses
   - Add admin responses to complaints
   - View complaint statistics

## Troubleshooting

If the admin user already exists, the script will notify you. To reset:
1. Delete the existing admin user from the database
2. Run the creation script again

Or manually update the password in the database using bcrypt hash.

