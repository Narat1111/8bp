const db = require('./db');
require('dotenv').config();

const setupDB = async () => {
    try {
        await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        await db.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        key_value VARCHAR(255) UNIQUE NOT NULL,
        is_sold BOOLEAN DEFAULT false,
        sold_to_email VARCHAR(255),
        sold_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        license_id INTEGER REFERENCES licenses(id),
        customer_email VARCHAR(255) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        await db.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Seed data
        const res = await db.query('SELECT COUNT(*) FROM products');
        if (res.rows[0].count === '0') {
            const p1 = await db.query(
                "INSERT INTO products (name, description, price, image_url) VALUES ('Facebook Account', 'High quality old Facebook account with marketplace enabled.', 5.99, '/images/fb.png') RETURNING id"
            );
            const p2 = await db.query(
                "INSERT INTO products (name, description, price, image_url) VALUES ('TikTok Account', 'TikTok account with 1K+ followers and live access.', 9.99, '/images/tiktok.png') RETURNING id"
            );
            const p3 = await db.query(
                "INSERT INTO products (name, description, price, image_url) VALUES ('YouTube Channel', 'YouTube channel ready for monetization.', 25.00, '/images/yt.png') RETURNING id"
            );

            // Seed dummy licenses
            await db.query("INSERT INTO licenses (product_id, key_value) VALUES ($1, 'FB-12345-ABCDE')", [p1.rows[0].id]);
            await db.query("INSERT INTO licenses (product_id, key_value) VALUES ($1, 'FB-67890-FGHIJ')", [p1.rows[0].id]);
            await db.query("INSERT INTO licenses (product_id, key_value) VALUES ($1, 'TK-11111-QWERT')", [p2.rows[0].id]);
            await db.query("INSERT INTO licenses (product_id, key_value) VALUES ($1, 'TK-22222-YUIOP')", [p2.rows[0].id]);
            await db.query("INSERT INTO licenses (product_id, key_value) VALUES ($1, 'YT-99999-ZXCBB')", [p3.rows[0].id]);

            console.log('Seeded initial products and licenses.');
        }

        // Seed admin user
        const adminRes = await db.query('SELECT COUNT(*) FROM admins');
        if (adminRes.rows[0].count === '0') {
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash('adminpassword', 10);
            await db.query("INSERT INTO admins (username, password_hash) VALUES ($1, $2)", ['admin', hash]);
            console.log('Seeded default admin user.');
        }

        console.log('Database successfully set up!');
        process.exit(0);
    } catch (err) {
        console.error('Error setting up database', err);
        process.exit(1);
    }
};

setupDB();
