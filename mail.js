// Sends our own emails through Resend (no packages needed). Off until these are set on Render:
//   RESEND_API_KEY   from resend.com
//   MAIL_FROM        e.g. "Optimus Garage <bookings@yourdomain.com>" (a domain you verified in Resend)
const https = require("https");
const KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.MAIL_FROM || "";
const configured = () => !!(KEY && FROM);

function send(to, subject, text, html) {
  return new Promise((resolve, reject) => {
    if (!configured()) return resolve("skipped (email not set up)");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to || "")) return resolve("skipped (bad email address)");
    const body = JSON.stringify({ from: FROM, to: [to], subject, text, html });
    const req = https.request("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let out = ""; res.on("data", (c) => (out += c));
      res.on("end", () => (res.statusCode < 300 ? resolve("email sent") : reject(new Error("Resend " + res.statusCode + ": " + out.slice(0, 200)))));
    });
    req.setTimeout(15000, () => req.destroy(new Error("Resend timed out")));
    req.on("error", reject);
    req.end(body);
  });
}
module.exports = { configured, send };
