const http = require('http');
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');

const PORT = process.env.PORT || 8080;
const proxy = httpProxy.createProxyServer({ changeOrigin: true });

// Remove headers that prevent iframe embedding
proxy.on('proxyRes', function(proxyRes, req, res) {
    const headers = proxyRes.headers;
    for (let key in headers) {
        if (/x-frame-options/i.test(key) || /content-security-policy/i.test(key)) {
            delete headers[key];
        }
    }
    headers['Access-Control-Allow-Origin'] = '*';
});

const server = http.createServer((req, res) => {
    // Serve frontend
    if (req.url === '/' || req.url.startsWith('/index.html')) {
        fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading page');
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }

    try {
        const reqUrl = new URL(req.url, `http://${req.headers.host}`);
        let targetUrl = reqUrl.searchParams.get('url');

        if (!targetUrl) {
            res.writeHead(400);
            return res.end('Missing URL parameter');
        }

        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = 'https://' + targetUrl;
        }

        proxy.web(req, res, { target: targetUrl }, err => {
            console.error('Proxy error:', err);
            res.writeHead(500);
            res.end('Proxy error: ' + err.message);
        });

    } catch (err) {
        res.writeHead(400);
        res.end('Invalid URL');
    }
});

server.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
