/**
 * SystemC CAM Power Model - Node.js Local Web & API Server
 * Enhanced with CORS headers, robust error handling, and CLI parameter bridging to sim.exe
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const PUBLIC_DIR = __dirname;
const BACKEND_DIR = path.join(__dirname, '../Backend');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.vcd': 'text/plain; charset=utf-8',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

const server = http.createServer((req, res) => {
    setCorsHeaders(res);

    // Handle OPTIONS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

    // API Endpoint: POST /api/simulate
    if (req.method === 'POST' && req.url === '/api/simulate') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const params = JSON.parse(body || '{}');
                console.log('Received custom simulation parameters:', params);

                let simArgs = ['--no-pause'];
                if (params.op_mode) {
                    simArgs.push('--op', String(params.op_mode));
                    if (params.op_mode === 'WRITE') {
                        const addr = Math.max(0, Math.min(9, parseInt(params.write_addr, 10) || 0));
                        const dataVal = (parseInt(params.write_data, 10) || 0) & 0xFFFF;
                        simArgs.push('--addr', String(addr));
                        simArgs.push('--data', '0x' + dataVal.toString(16).padStart(4, '0'));
                    } else {
                        const patVal = (parseInt(params.pattern, 10) || 0) & 0xFFFF;
                        simArgs.push('--pattern', '0x' + patVal.toString(16).padStart(4, '0'));
                    }
                }

                const cmd = `.\\sim.exe ${simArgs.join(' ')}`;
                console.log(`Executing in Backend: ${cmd}`);

                exec(cmd, { cwd: BACKEND_DIR }, (err, stdout, stderr) => {
                    if (err) {
                        console.error('sim.exe error:', stderr || err.message);
                    }
                    const jsonPath = path.join(BACKEND_DIR, 'simulation_data.json');
                    fs.readFile(jsonPath, 'utf8', (readErr, data) => {
                        if (readErr) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({ error: 'Failed to read simulation output: ' + readErr.message }));
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(data);
                    });
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload: ' + e.message }));
            }
        });
        return;
    }

    // API Endpoint: POST /api/recompile
    if (req.method === 'POST' && req.url === '/api/recompile') {
        const cmd = 'g++ -std=c++17 -DSC_ALLOW_DEPRECATED_IEEE_API -I C:/systemc/include -L C:/systemc/lib main.cpp cam_power_model.cpp -lsystemc -o sim.exe && .\\sim.exe --no-pause';
        console.log(`Recompiling SystemC: ${cmd}`);
        exec(cmd, { cwd: BACKEND_DIR }, (err, stdout, stderr) => {
            if (err) {
                console.error('Compilation failed:', stderr || err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: stderr || err.message }));
            }
            const jsonPath = path.join(BACKEND_DIR, 'simulation_data.json');
            fs.readFile(jsonPath, 'utf8', (readErr, data) => {
                if (readErr) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Recompiled but could not read data: ' + readErr.message }));
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data || JSON.stringify({ status: 'ok' }));
            });
        });
        return;
    }

    // Static File Serving
    const reqUrlClean = req.url.split('?')[0];
    let filePath;
    if (reqUrlClean === '/simulation_data.json') {
        filePath = path.join(BACKEND_DIR, 'simulation_data.json');
    } else if (reqUrlClean === '/cam_trace.vcd') {
        filePath = path.join(BACKEND_DIR, 'cam_trace.vcd');
    } else {
        filePath = path.join(PUBLIC_DIR, reqUrlClean === '/' ? 'index.html' : reqUrlClean);
    }

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
            res.end(content);
        }
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n========================================================`);
        console.error(`  [WARNING] Port ${PORT} is already in use!`);
        console.error(`========================================================`);
        console.log(`  The server is already running and accessible at:`);
        console.log(`  --> http://localhost:${PORT}`);
        console.log(`  If you want to restart, close the other terminal running it.`);
        console.log(`========================================================\n`);
    } else {
        console.error('\n[SERVER ERROR]:', err);
    }
});

server.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(`  SYSTEMC CAM POWER VISUALIZER SERVER RUNNING           `);
    console.log(`========================================================`);
    console.log(`  Local Web UI: http://localhost:${PORT}`);
    console.log(`  SystemC Backend Integration: ACTIVE`);
    console.log(`  Ready and listening for simulation queries & logs.`);
    console.log(`  (Press Ctrl+C to stop the server)`);
    console.log(`========================================================\n`);
});
