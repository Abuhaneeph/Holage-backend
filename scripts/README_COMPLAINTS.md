# Complaints Table Setup

## Create Complaints Table

Before using the complaints feature, you need to create the complaints table in your database.

### Option 1: Using MySQL Client

Run the SQL script:

```bash
mysql -u your_username -p holage_db < scripts/create_complaints_table.sql
```

### Option 2: Using MySQL Command Line

1. Connect to MySQL:
```bash
mysql -u your_username -p
```

2. Select the database:
```sql
USE holage_db;
```

3. Run the SQL script:
```sql
source scripts/create_complaints_table.sql;
```

Or copy and paste the contents of `create_complaints_table.sql` directly into your MySQL client.

### Verify Table Creation

After running the script, verify the table was created:

```sql
SHOW TABLES LIKE 'complaints';
DESCRIBE complaints;
```

## Troubleshooting

If you get a 500 error when accessing complaints:

1. **Check if table exists:**
   ```sql
   SHOW TABLES LIKE 'complaints';
   ```
   If it doesn't exist, run the create script above.

2. **Check table structure:**
   ```sql
   DESCRIBE complaints;
   ```
   Make sure all columns match the expected structure.

3. **Check server logs:**
   Look at the backend server console for detailed error messages.

4. **Verify database connection:**
   Make sure your database connection is working properly.

