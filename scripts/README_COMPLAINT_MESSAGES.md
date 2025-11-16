# Complaint Messages/Conversation Threading Setup

This document explains how to set up the complaint messages system for conversation threading.

## Database Setup

Run the SQL script to create the `complaint_messages` table:

```bash
mysql -u your_username -p holage_db < scripts/create_complaint_messages_table.sql
```

Or execute the SQL directly in your MySQL client:

```sql
USE holage_db;

CREATE TABLE IF NOT EXISTS complaint_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaintId INT NOT NULL,
    senderId INT NOT NULL,
    senderRole VARCHAR(50) NOT NULL,
    senderName VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaintId) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_complaintId (complaintId),
    INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Features

1. **Conversation Threading**: Each complaint can have multiple messages/replies
2. **Admin Replies**: Admins can reply to any complaint
3. **User Replies**: Users can reply to their own complaints
4. **Status Updates**: When someone replies to a resolved/closed complaint, it automatically changes to "in_progress"
5. **Real-time Updates**: Messages are displayed in chronological order

## API Endpoints

### For All Users:
- `POST /api/complaints/:complaintId/messages` - Add a reply to a complaint
- `GET /api/complaints/:complaintId/messages` - Get all messages for a complaint

### For Admin:
- `GET /api/complaints/:complaintId` - Get complaint with all messages
- `PUT /api/complaints/:complaintId` - Update complaint status

## Usage

1. Admin can click on any complaint to view the conversation thread
2. Admin can type a reply and send it
3. Users can click on their complaint to view the conversation
4. Users can reply to admin messages
5. The conversation continues back and forth

