CREATE DATABASE IF NOT EXISTS holage_db;

USE holage_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fullName VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('shipper', 'trucker', 'admin') NOT NULL,
    isVerified BOOLEAN DEFAULT FALSE,
    verificationToken VARCHAR(255) NULL,
    resetPasswordToken VARCHAR(255) NULL,
    resetPasswordExpires DATETIME NULL,
    phone VARCHAR(20) NULL,
    address TEXT NULL,
    nin VARCHAR(255) NULL,
    profilePhoto VARCHAR(255) NULL,
    driverLicense VARCHAR(255) NULL,
    vehicleReg VARCHAR(255) NULL,
    plateNumber VARCHAR(255) NULL,
    vehicleType VARCHAR(255) NULL,
    utilityBill VARCHAR(255) NULL,
    passportPhoto VARCHAR(255) NULL,
    kycStatus ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
