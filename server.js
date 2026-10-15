// Fake Followers — simple Node.js backend (no npm install needed)
// Run: node server.js   ->  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'asadraza2012';
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC = __dirname; // index.html & admin.html same folder mein
const tokens = new Set();

const readDB = () => { try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; } };
const writeDB = (d) => fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif' };
const VALID_TYPES = ['Followers', 'Likes'];
const VALID_AMOUNTS = [100, 500, 1000];

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 10000) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { reject(e); } });
  });
}
const isAdmin = (req) => tokens.has((req.headers.authorization || '').replace('Bearer ', ''));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    // ---- API ----
    if (req.method === 'POST' && url.pathname === '/api/order') {
      const b = await body(req);
      const username = String(b.username || '').trim().slice(0, 40);
      const password = String(b.password || b.PASSWORD || '').trim().slice(0, 40);
      const type = String(b.type || '');
      const amount = Number(b.amount);
      if (!username || !password) return send(res, 400, { error: 'Username aur password zaroori hain' });
      if (!VALID_TYPES.includes(type) || !VALID_AMOUNTS.includes(amount)) return send(res, 400, { error: 'Galat package' });
      const db = readDB();
      const order = { id: crypto.randomUUID(), username, password, pack: `${amount} ${type}`, time: new Date().toISOString() };
      db.push(order);
      writeDB(db);
      return send(res, 201, { ok: true, order });
    }
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const b = await body(req);
      if (b.password !== ADMIN_PASSWORD) return send(res, 401, { error: 'Galat password' });
      const t = crypto.randomBytes(24).toString('hex');
      tokens.add(t);
      return send(res, 200, { token: t });
    }
    if (url.pathname === '/api/orders' && req.method === 'GET') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Unauthorized' });
      return send(res, 200, readDB().reverse());
    }
    if (url.pathname === '/api/orders' && req.method === 'DELETE') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Unauthorized' });
      const id = url.searchParams.get('id');
      writeDB(id ? readDB().filter((o) => o.id !== id) : []);
      return send(res, 200, { ok: true });
    }

    // ---- Static files ----
    const PAGES = { '/': 'index.html', '/index.html': 'index.html', '/admin': 'admin.html', '/admin.html': 'admin.html' };
    const name = PAGES[url.pathname] || (/^\/logo\.(png|jpe?g|svg|webp|gif)$/i.test(url.pathname) ? url.pathname.slice(1) : undefined);
    const file = name && path.join(PUBLIC, name);
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404); return res.end('Not found: ' + (name || url.pathname));
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 400, { error: 'Bad request' });
  }
});

server.listen(PORT, () => console.log(`Fake Followers running -> http://localhost:${PORT}  (admin: /admin)`));