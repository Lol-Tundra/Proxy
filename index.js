const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');

const PORT = process.env.PORT || 8080;
const proxy = httpProxy.createProxyServer({ changeOrigin: true });

proxy.on('proxyRes', (proxyRes, req, res) => {
    const headers = proxyRes.headers;
    for (let key in headers) {
        if (/x-frame-options/i.test(key) || /content-security-policy/i.test(key)) {
            delete headers[key];
        }
    }
    headers['Access-Control-Allow-Origin'] = '*';
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
});

proxy.on('proxyReq', (proxyReq, req) => {
    proxyReq.setHeader(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
});

const server = http.createServer((req, res) => {
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

        // Only Google search if input is NOT a proper URL
        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(targetUrl);
        }

        proxy.web(req, res, { target: targetUrl }, err => {
            console.error('Proxy error:', err.message);
            res.writeHead(500);
            res.end('Cannot load this site through proxy.');
        });

    } catch (err) {
        res.writeHead(400);
        res.end('Invalid URL');
    }
});

server.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
