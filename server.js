/**
 * Render entry point — starts the FastAPI/uvicorn backend.
 * Render runs `node server.js`; this script installs Python deps then launches uvicorn.
 */
const { spawn, execSync } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || '8000';
const backendDir = path.join(__dirname, 'backend_fastapi');

// Install Python dependencies
try {
    console.log('==> Installing Python dependencies...');
    execSync('pip install -r requirements.txt', { stdio: 'inherit', cwd: __dirname });
} catch (e) {
    console.error('pip install failed:', e.message);
}

// Start uvicorn
console.log(`==> Starting uvicorn on port ${PORT}...`);
const proc = spawn('uvicorn', ['main:app', '--host', '0.0.0.0', '--port', PORT], {
    cwd: backendDir,
    stdio: 'inherit'
});

proc.on('exit', (code) => {
    console.error(`uvicorn exited with code ${code}`);
    process.exit(code ?? 1);
});
