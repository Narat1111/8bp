const { pool } = require('../config/database');

const sampleTemplates = [
    { title: 'Premium UI Kit Bundle', description: 'A comprehensive UI kit with 200+ components for modern web applications. Includes dark mode variants, responsive layouts, and Figma source files.', image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800', unlock_url: 'https://drive.google.com/file/d/premium-ui-kit', unlock_password: 'UIKit2026#Secure', price: 0.01 },
    { title: 'Full-Stack Course Access', description: 'Complete full-stack web development course covering React, Node.js, databases, deployment, and more. 40+ hours of video content.', image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800', unlock_url: 'https://courses.example.com/fullstack-2026', unlock_password: 'FullStack@Access2026', price: 0.01 },
    { title: 'E-commerce Template', description: 'Production-ready e-commerce website template with cart, checkout, admin dashboard, and payment integration. Built with Next.js 15.', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800', unlock_url: 'https://github.com/templates/ecommerce-nextjs', unlock_password: 'EComm#Template2026', price: 0.01 },
    { title: 'Mobile App Source Code', description: 'Cross-platform mobile app source code built with React Native. Includes authentication, push notifications, and offline support.', image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800', unlock_url: 'https://drive.google.com/file/d/mobile-app-source', unlock_password: 'MobileApp$2026', price: 0.01 },
    { title: 'AI Prompt Engineering Guide', description: 'Master prompt engineering with 500+ curated prompts for ChatGPT, Claude, and Gemini. Includes templates for coding, writing, and business.', image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800', unlock_url: 'https://docs.example.com/ai-prompts-guide', unlock_password: 'AIPrompts#2026', price: 0.01 },
];

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...\n');
        for (const t of sampleTemplates) {
            const [result] = await pool.execute('INSERT INTO templates (title, description, image, unlock_url, unlock_password, price) VALUES (?, ?, ?, ?, ?, ?)', [t.title, t.description, t.image, t.unlock_url, t.unlock_password, t.price]);
            console.log(`  ✅ Inserted: "${t.title}" (ID: ${result.insertId})`);
        }
        console.log(`\n🎉 Seeding completed! ${sampleTemplates.length} templates inserted.`);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') console.log('⚠️  Some templates already exist.');
        else console.error('❌ Seeding failed:', error.message);
    } finally { process.exit(0); }
}

seedDatabase();
