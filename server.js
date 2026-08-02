/**
 * SystemC CAM Power Model - Node.js Local Web & API Server
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.vcd': 'text/plain',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

    // API Endpoint: /api/simulate
    if (req.method === 'POST' && req.url === '/api/simulate') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const params = JSON.parse(body);
                console.log('Received custom simulation parameters:', params);

                // Run sim.exe --no-pause to refresh trace
                exec('.\\sim.exe --no-pause', { cwd: PUBLIC_DIR }, (err, stdout, stderr) => {
                    const jsonPath = path.join(PUBLIC_DIR, 'simulation_data.json');
                    fs.readFile(jsonPath, 'utf8', (readErr, data) => {
                        if (readErr) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({ error: 'Failed to read simulation output' }));
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(data);
                    });
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            }
        });
        return;
    }

    // API Endpoint: /api/recompile
    if (req.method === 'POST' && req.url === '/api/recompile') {
        const cmd = 'g++ -std=c++17 -DSC_ALLOW_DEPRECATED_IEEE_API -I C:/systemc/include -L C:/systemc/lib main.cpp cam_power_model.cpp -lsystemc -o sim.exe && .\\sim.exe --no-pause';
        exec(cmd, { cwd: PUBLIC_DIR }, (err, stdout, stderr) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: stderr || err.message }));
            }
            const jsonPath = path.join(PUBLIC_DIR, 'simulation_data.json');
            fs.readFile(jsonPath, 'utf8', (readErr, data) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data || JSON.stringify({ status: 'ok' }));
            });
        });
        return;
    }

    // Static File Serving
    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(`  SYSTEMC CAM POWER VISUALIZER SERVER RUNNING           `);
    console.log(`========================================================`);
    console.log(`  Local Web UI: http://localhost:${PORT}`);
    console.log(`  SystemC Backend Integration: ACTIVE`);
    console.log(`========================================================`);
});
