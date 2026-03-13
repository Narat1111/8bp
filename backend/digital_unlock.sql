-- ============================================================
-- Digital Link Unlock Platform - Database Schema
-- Import this file in phpMyAdmin (XAMPP)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `digital_unlock`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `digital_unlock`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `templates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `image` VARCHAR(500),
  `unlock_url` VARCHAR(500) NOT NULL,
  `unlock_password` VARCHAR(255) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.01,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `unlocks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `template_id` INT NOT NULL,
  `payment_status` ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_template` (`user_id`, `template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `template_id` INT,
  `amount` DECIMAL(10, 2) NOT NULL,
  `method` VARCHAR(50) DEFAULT 'bakong_khqr',
  `status` ENUM('pending', 'success', 'failed', 'expired') DEFAULT 'pending',
  `transaction_id` VARCHAR(255) UNIQUE,
  `qr_data` TEXT,
  `md5_hash` VARCHAR(64),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE SET NULL,
  INDEX `idx_transaction` (`transaction_id`),
  INDEX `idx_user_status` (`user_id`, `status`),
  INDEX `idx_md5` (`md5_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `templates` (`title`, `description`, `image`, `unlock_url`, `unlock_password`, `price`) VALUES
('Premium UI Kit Bundle', 'A comprehensive UI kit with 200+ components for modern web applications. Includes dark mode variants, responsive layouts, and Figma source files.', 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800', 'https://drive.google.com/file/d/premium-ui-kit', 'UIKit2026#Secure', 0.01),
('Full-Stack Course Access', 'Complete full-stack web development course covering React, Node.js, databases, deployment, and more. 40+ hours of video content.', 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800', 'https://courses.example.com/fullstack-2026', 'FullStack@Access2026', 0.01),
('E-commerce Template', 'Production-ready e-commerce website template with cart, checkout, admin dashboard, and payment integration. Built with Next.js 15.', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800', 'https://github.com/templates/ecommerce-nextjs', 'EComm#Template2026', 0.01),
('Mobile App Source Code', 'Cross-platform mobile app source code built with React Native. Includes authentication, push notifications, and offline support.', 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800', 'https://drive.google.com/file/d/mobile-app-source', 'MobileApp$2026', 0.01),
('AI Prompt Engineering Guide', 'Master prompt engineering with 500+ curated prompts for ChatGPT, Claude, and Gemini. Includes templates for coding, writing, and business.', 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800', 'https://docs.example.com/ai-prompts-guide', 'AIPrompts#2026', 0.01);
