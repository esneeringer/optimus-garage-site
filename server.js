// Very basic web server for Optimus Garage Company. No packages needed.
// Run:  node server.js   then open http://localhost:3000
//
// On the internet, set the SITE_PASSWORD environment variable to keep the
// site private. Anyone without the password sees a login box and nothing else.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.SITE_PASSWORD || "";
// On a hosting service (Render sets RENDER=true), stay locked until a password is set.
const LOCKED = !!process.env.RENDER && !PASSWORD;
const PUBLIC = path.join(__dirname, "public");
const LOG = path.join(__dirname, "requests.log");
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

// What each kind of post may contain, and the longest each field can be.
const SHAPES = {
  request: { service: 40, name: 80, phone: 30, address: 200, note: 500, email: 120, date: 10, slot: 20, when: 60 },
  prefs: { phone: 30, channel: 10, email: 120 },
  schedule: { phone: 30, date: 10, slot: 20 },
};
// The fields that must be filled in for a post to be accepted.
const VALID = {
  request: (r) => r.name && r.phone && r.address && r.service,
  prefs: (r) => r.phone && (r.channel === "text" || r.channel === "email"),
  schedule: (r) => r.phone && /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") && r.slot,
};

// Keep only the expected text fields, trimmed, with control characters removed.
function clean(obj, shape) {
  const out = {};
  for (const key of Object.keys(shape)) {
    if (typeof obj[key] === "string") {
      out[key] = obj[key].replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, shape[key]);
    }
  }
  return out;
}

// Simple limit: 30 posts per 10 minutes from one address.
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
}
function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown";
}

// Password check. Either a login cookie (set by the /login page) or HTTP Basic works.
const TOKEN = PASSWORD ? crypto.createHmac("sha256", PASSWORD).update("optimus-garage-login").digest("hex") : "";
function hasCookie(req) {
  const m = /(?:^|;\s*)og_auth=([a-f0-9]+)/.exec(req.headers.cookie || "");
  if (!m || m[1].length !== TOKEN.length) return false;
  return crypto.timingSafeEqual(Buffer.from(m[1]), Buffer.from(TOKEN));
}
function samePassword(given) {
  const a = Buffer.from(given);
  const b = Buffer.from(PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function allowed(req) {
  if (!PASSWORD) return true;
  if (hasCookie(req)) return true;
  const header = req.headers.authorization || "";
  if (header.slice(0, 6) !== "Basic ") return false;
  return samePassword(Buffer.from(header.slice(6), "base64").toString().split(":").slice(1).join(":"));
}
function loginPage(bad) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Optimus Garage Company</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F8FC;color:#0A1A3A;font:500 17px system-ui,sans-serif}
form{width:min(340px,86vw)}h1{font:900 2rem/1 Arial Narrow,Impact,sans-serif;text-transform:uppercase;margin:0 0 6px}p{margin:0 0 16px;color:#4B5668}
input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;border:3px solid #0A1A3A;margin-bottom:12px}
button{background:#F5CB45;font-weight:800;text-transform:uppercase;cursor:pointer;box-shadow:0 5px 0 #0A1A3A}button:active{transform:translateY(5px);box-shadow:none}
.e{color:#C0352C;font-weight:700}</style></head><body><form method="post" action="/login"><h1>Optimus Garage Company</h1>
<p>Private preview. Enter the password.</p>${bad ? '<p class="e">That password was not right.</p>' : ""}
<input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required><button>Enter</button></form></body></html>`;
}

function reply(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(body);
}

// Save a small JSON post to requests.log and print it in the terminal
// (on a host like Render, the terminal output shows up in the Logs tab).
function saveJson(req, res, type, describe) {
  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > 10000) {
      reply(res, 413, '{"ok":false}', "application/json");
      return req.destroy();
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    try {
      const r = clean(JSON.parse(Buffer.concat(chunks).toString()), SHAPES[type]);
      if (!VALID[type](r)) return reply(res, 400, '{"ok":false}', "application/json");
      const line = JSON.stringify({ time: new Date().toISOString(), type, ...r });
      let logSize = 0;
      try { logSize = fs.statSync(LOG).size; } catch (e) {}
      if (logSize < MAX_LOG_BYTES) fs.appendFileSync(LOG, line + "\n");
      console.log(describe(r));
      reply(res, 200, '{"ok":true}', "application/json");
    } catch (e) {
      reply(res, 400, '{"ok":false}', "application/json");
    }
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");

  // Health check for the hosting service. No password, shows nothing private.
  if (req.url === "/healthz") return reply(res, 200, "ok");

  if (LOCKED) return reply(res, 503, "This site is locked until a password is set (SITE_PASSWORD).");

  if (req.url === "/login" && req.method === "POST") {
    if (tooMany(clientIp(req))) return reply(res, 429, "Too many tries. Wait a few minutes.");
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 2000) req.destroy(); });
    req.on("end", () => {
      const given = new URLSearchParams(body).get("password") || "";
      if (!samePassword(given)) return reply(res, 401, loginPage(true), "text/html; charset=utf-8");
      const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
      res.writeHead(303, { Location: "/", "Set-Cookie": "og_auth=" + TOKEN + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000" + secure });
      res.end();
    });
    return;
  }

  if (!allowed(req)) {
    if (req.method === "GET" && !req.url.startsWith("/api/")) {
      return reply(res, 401, loginPage(false), "text/html; charset=utf-8");
    }
    return reply(res, 401, "Password needed.");
  }

  if (req.method === "POST") {
    if (tooMany(clientIp(req))) return reply(res, 429, '{"ok":false}', "application/json");
    // New booking details. This is the spot to call Jobber later.
    if (req.url === "/api/request") {
      return saveJson(req, res, "request", (r) =>
        "New booking: " + [r.service, r.name, r.phone, r.address, r.note].filter(Boolean).join(" | "));
    }
    // The day and arrival window the customer picked.
    if (req.url === "/api/schedule") {
      return saveJson(req, res, "schedule", (r) => "Time picked for " + r.phone + ": " + r.date + ", " + r.slot);
    }
    // How the customer wants updates (text or email).
    if (req.url === "/api/prefs") {
      return saveJson(req, res, "prefs", (r) =>
        "Updates for " + r.phone + ": by " + r.channel + (r.email ? " (" + r.email + ")" : ""));
    }
    return reply(res, 404, "Not found");
  }

  if (req.method !== "GET" && req.method !== "HEAD") return reply(res, 405, "Method not allowed");

  // Everything else: serve files from the public folder.
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch (e) {
    return reply(res, 400, "Bad request");
  }
  const file = path.join(PUBLIC, urlPath === "/" ? "index.html" : urlPath);
  if (!file.startsWith(PUBLIC + path.sep)) return reply(res, 403, "Forbidden");
  fs.readFile(file, (err, data) => {
    if (err) return reply(res, 404, "Not found");
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
});

// 0.0.0.0 lets your phone on the same Wi-Fi (or a hosting service) reach it.
server.listen(PORT, "0.0.0.0", () => {
  console.log("Optimus Garage Company site running on port " + PORT);
  console.log("  On this computer:  http://localhost:" + PORT);
  console.log("  Password protection: " + (PASSWORD ? "ON" : LOCKED ? "LOCKED (set SITE_PASSWORD to open the site)" : "off (set SITE_PASSWORD to turn it on)"));
});
