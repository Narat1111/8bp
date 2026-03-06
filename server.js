const { execSync } = require('child_process');

const port = process.env.PORT || 8000;
console.log(`Starting Python backend on port ${port}...`);

try {
    // Run uvicorn through python to ensure it catches the correct environment paths
    execSync(`cd backend && python -m uvicorn main:app --host 0.0.0.0 --port ${port}`, {
        stdio: 'inherit',
        shell: true
    });
} catch (error) {
    console.error('Failed to start backend:', error);
    process.exit(1);
}
