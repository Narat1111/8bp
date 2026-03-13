const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'digital_unlock';

async function initDatabase() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT, 10) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true,
        });

        console.log('🔗 Connected to MySQL server');
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log(`📦 Database "${DB_NAME}" ready`);
        await connection.query(`USE \`${DB_NAME}\``);

        await connection.query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_email (email)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
        console.log('✅ Table "users" created');

        await connection.query(`CREATE TABLE IF NOT EXISTS templates (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, image VARCHAR(500), unlock_url VARCHAR(500) NOT NULL, unlock_password VARCHAR(255) NOT NULL, price DECIMAL(10,2) NOT NULL DEFAULT 0.01, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
        console.log('✅ Table "templates" created');

        await connection.query(`CREATE TABLE IF NOT EXISTS unlocks (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, template_id INT NOT NULL, payment_status ENUM('pending','completed','failed') DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE, INDEX idx_user_template (user_id, template_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
        console.log('✅ Table "unlocks" created');

        await connection.query(`CREATE TABLE IF NOT EXISTS payments (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, template_id INT, amount DECIMAL(10,2) NOT NULL, method VARCHAR(50) DEFAULT 'bakong_khqr', status ENUM('pending','success','failed','expired') DEFAULT 'pending', transaction_id VARCHAR(255) UNIQUE, qr_data TEXT, md5_hash VARCHAR(64), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL, INDEX idx_transaction (transaction_id), INDEX idx_user_status (user_id, status), INDEX idx_md5 (md5_hash)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
        console.log('✅ Table "payments" created');

        console.log('\n🎉 Database initialization completed successfully!');
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

initDatabase();
