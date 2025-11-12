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
            // Clone headers and remove frame-blocking headers
            let headers = { ...backend_res.headers };
            for (let key in headers) {
                if (/x-frame-options/i.test(key) || /content-security-policy/i.test(key)) {
                    delete headers[key];
                }
            }

            // Add CORS headers
            headers['Access-Control-Allow-Origin'] = '*';

            // Rewrite Location headers for redirects
            if (headers['location']) {
                headers['location'] = `/??url=${encodeURIComponent(headers['location'])}`;
            }

            res.writeHead(backend_res.statusCode, headers);

            // Capture body to remove inline CSP meta tags
            let body = '';
            backend_res.on('data', chunk => { body += chunk.toString(); });
            backend_res.on('end', () => {
                body = body.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
                res.end(body);
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
