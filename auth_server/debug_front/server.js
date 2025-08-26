const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const FRONTEND_PORT = process.env.FRONTEND_PORT || 3001;
const BACKEND_PORT = process.env.PORT || 3000;
const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || `http://localhost:${BACKEND_PORT}`;

function proxyToAuthServer(req, res) {
    const parsedUrl = new URL(req.url, AUTH_SERVER_URL);
    
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: req.method,
        headers: {
            ...req.headers,
            host: parsedUrl.host
        }
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
        // Copy response headers
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        
        // Pipe the response
        proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>502 - Bad Gateway</h1><p>Auth server is not available</p>');
    });
    
    // Pipe the request
    req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);
    
    // Proxy auth-related requests to the backend auth server
    if (pathname.startsWith('/auth/')) {
        proxyToAuthServer(req, res);
        return;
    }
    
    // Default to index.html
    if (pathname === '/') {
        pathname = '/index.html';
    }
    
    const filePath = path.join(__dirname, pathname);
    const ext = path.extname(filePath);
    
    // Set content type based on file extension
    let contentType = 'text/html';
    switch (ext) {
        case '.css':
            contentType = 'text/css';
            break;
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
        case '.jpeg':
            contentType = 'image/jpeg';
            break;
        case '.svg':
            contentType = 'image/svg+xml';
            break;
    }
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <body>
                        <h1>404 - Not Found</h1>
                        <p>The requested file was not found.</p>
                        <a href="/">Go back to home</a>
                    </body>
                </html>
            `);
            return;
        }
        
        // Read and serve the file
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>500 - Internal Server Error</h1>');
                return;
            }
            
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end(data);
        });
    });
});


server.listen(FRONTEND_PORT, '0.0.0.0', () => {
    console.log(`Frontend server running at http://0.0.0.0:${FRONTEND_PORT}`);
    console.log(`Proxying auth requests to: ${AUTH_SERVER_URL}`);
    console.log('OAuth test frontend is ready!');
    console.log('\nSetup instructions:');
    console.log('1. Create Discord OAuth app at https://discord.com/developers/applications');
    console.log('2. Create GitHub OAuth app at https://github.com/settings/developers');
    console.log('3. Set redirect URIs to:');
    console.log(`   Discord: ${AUTH_SERVER_URL}/auth/oauth/discord/callback`);
    console.log(`   GitHub: ${AUTH_SERVER_URL}/auth/oauth/github/callback`);
    console.log('4. Update .env file with your client IDs and secrets');
    console.log('5. Start the auth server: npm run dev');
    console.log(`6. Visit http://localhost:${FRONTEND_PORT} to test OAuth`);
    console.log('\nEnvironment variables:');
    console.log(`   FRONTEND_PORT=${FRONTEND_PORT}`);
    console.log(`   BACKEND_PORT=${BACKEND_PORT}`);
    console.log(`   AUTH_SERVER_URL=${AUTH_SERVER_URL}`);
});