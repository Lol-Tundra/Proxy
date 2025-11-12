const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

const proxy = http.createServer((req, res) => {
    // Serve the frontend HTML for root path
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error loading page');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }

    // Parse the target URL from query parameter
    const parsedUrl = url.parse(req.url, true);
    const targetUrl = parsedUrl.query.url;

    if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
                <body>
                    <h1>Simple Proxy Server</h1>
                    <p>Usage: /?url=https://example.com</p>
                    <form method="GET">
                        <input type="text" name="url" placeholder="Enter URL" style="width: 300px"/>
                        <button type="submit">Go</button>
                    </form>
                </body>
            </html>
        `);
        return;
    }

    try {
        const target = url.parse(targetUrl);
        const protocol = target.protocol === 'https:' ? https : http;

        const options = {
            hostname: target.hostname,
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: target.path,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0',
            },
        };

        console.log(`Fetching: ${targetUrl}`);

        const backend_req = protocol.request(options, (backend_res) => {
            // Remove headers that prevent iframe embedding
            const headers = { ...backend_res.headers };
            delete headers['x-frame-options'];
            delete headers['content-security-policy'];
            delete headers['content-security-policy-report-only'];
            
            // Add CORS headers to allow browser access
            headers['Access-Control-Allow-Origin'] = '*';

            res.writeHead(backend_res.statusCode, headers);

            backend_res.on('data', (chunk) => {
                res.write(chunk);
            });

            backend_res.on('end', () => {
                res.end();
            });
        });

        backend_req.on('error', (err) => {
            console.error('Error:', err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Proxy error: ' + err.message);
        });

        backend_req.end();

    } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid URL');
    }
});

proxy.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
