// Short-lived photo hosting so Jobber can fetch the customer's photos when it makes the request note.
// Photos live in memory for 20 minutes under a random id. Nothing is written to disk.
const crypto = require("crypto");
const store = new Map(); // id -> { buf, type, at }
const MAX_BYTES = 2.5 * 1024 * 1024;
const TTL = 20 * 60 * 1000;

function sweep() { const now = Date.now(); for (const [k, v] of store) if (now - v.at > TTL) store.delete(k); }

function add(dataUrl) {
  sweep();
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  if (!buf.length || buf.length > MAX_BYTES || store.size > 60) return null;
  const id = crypto.randomBytes(12).toString("hex");
  store.set(id, { buf, type: m[1], at: Date.now() });
  return id;
}
function get(id) { sweep(); return store.get(id) || null; }

function base() {
  return (process.env.PUBLIC_URL || (process.env.JOBBER_REDIRECT_URI || "").replace(/\/jobber\/.*$/, "")).replace(/\/$/, "");
}
function url(id) {
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const p = /^[a-f0-9]{24}$/.test(id || "") && store.get(id);
  return p && base() ? base() + "/p/" + id + "." + ext[p.type] : "";
}
module.exports = { add, get, url, MAX_BYTES };
