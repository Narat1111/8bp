/**
 * Render entry point — creates a Python venv, installs deps, then starts uvicorn.
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || '8000';
const rootDir = __dirname;
const backendDir = path.join(rootDir, 'backend_fastapi');
const venvDir = path.join(rootDir, '.venv');
const pip = path.join(venvDir, 'bin', 'pip');
const uvicorn = path.join(venvDir, 'bin', 'uvicorn');

// Create venv if it doesn't exist
if (!fs.existsSync(venvDir)) {
    console.log('==> Creating Python virtual environment...');
    execSync('python3 -m venv .venv', { stdio: 'inherit', cwd: rootDir });
}

// Install dependencies into venv
console.log('==> Installing Python dependencies...');
execSync(`${pip} install -r requirements.txt`, { stdio: 'inherit', cwd: rootDir });

// Start uvicorn from venv
console.log(`==> Starting uvicorn on port ${PORT}...`);
const proc = spawn(uvicorn, ['main:app', '--host', '0.0.0.0', '--port', PORT], {
    cwd: backendDir,
    stdio: 'inherit'
});

proc.on('error', (err) => {
    console.error('Failed to start uvicorn:', err.message);
    process.exit(1);
});

proc.on('exit', (code) => {
    console.error(`uvicorn exited with code ${code}`);
    process.exit(code ?? 1);
});
