// server.js - Custom Local Dev Server for BeanForge (Zero-dependency)
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load .env variables
require('dotenv').config();

// Single-Thread Guardrails (prevent process crashes from uncaught errors)
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Set Security and CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Custom Content-Security-Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com; " +
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; " +
    "connect-src 'self' https://vitals.vercel-insights.com;"
  );

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. API Endpoint Handler
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.substring(5); // e.g. "products"
    
    // Path Traversal Mitigation: Alphanumeric and hyphens/underscores only
    if (!/^[a-zA-Z0-9_-]+$/.test(apiName)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid API endpoint name' }));
      return;
    }

    const filePath = path.join(__dirname, 'api', `${apiName}.js`);

    if (fs.existsSync(filePath)) {
      try {
        // Read request body
        let body = '';
        await new Promise((resolve) => {
          req.on('data', chunk => { body += chunk; });
          req.on('end', resolve);
        });

        // Parse JSON body if present
        let parsedBody = {};
        if (body) {
          try {
            parsedBody = JSON.parse(body);
          } catch (e) {
            parsedBody = {};
          }
        }

        // Mock req and res objects to match Vercel serverless functions signature
        const mockReq = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          query: parsedUrl.query,
          body: parsedBody
        };

        const mockRes = {
          statusCode: 200,
          headers: {},
          setHeader(name, value) {
            this.headers[name] = value;
            return this;
          },
          status(code) {
            this.statusCode = code;
            return this;
          },
          json(data) {
            res.writeHead(this.statusCode, {
              'Content-Type': 'application/json',
              ...this.headers
            });
            res.end(JSON.stringify(data));
            return this;
          },
          send(data) {
            res.writeHead(this.statusCode, this.headers);
            res.end(data);
            return this;
          }
        };

        // Dynamically load the API script and clean require cache for hot-reloading
        delete require.cache[require.resolve(filePath)];
        const handler = require(filePath);
        await handler(mockReq, mockRes);
        return;
      } catch (err) {
        console.error(`Error in API endpoint ${apiName}:`, err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Internal Server Error', error: err.message }));
        return;
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'API Endpoint Not Found' }));
      return;
    }
  }

  // 2. Static File Handler
  let safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(__dirname, 'public', safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Single-Page Application (SPA) routing fallback
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`BeanForge Local Server is running at http://localhost:${PORT}`);
});
