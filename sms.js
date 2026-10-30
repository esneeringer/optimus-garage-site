// Sends our own text messages through Twilio (no packages needed).
// Off until these are set on Render: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM
// (your Twilio phone number, like +14105550123, or a Messaging Service id starting with MG).
const https = require("https");

const SID = process.env.TWILIO_ACCOUNT_SID || "";
const TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const FROM = process.env.TWILIO_FROM || "";

const configured = () => !!(SID && TOKEN && FROM);

function toE164(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return "";
}

function send(to, body) {
  return new Promise((resolve, reject) => {
    const num = toE164(to);
    if (!configured()) return resolve("skipped (Twilio not set up)");
    if (!num) return resolve("skipped (not a US phone number)");
    const params = { To: num, Body: body };
    params[/^MG/.test(FROM) ? "MessagingServiceSid" : "From"] = FROM;
    const data = new URLSearchParams(params).toString();
    const req = https.request(
      "https://api.twilio.com/2010-04-01/Accounts/" + encodeURIComponent(SID) + "/Messages.json",
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(SID + ":" + TOKEN).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve("text sent to ***" + num.slice(-4));
          reject(new Error("Twilio " + res.statusCode + ": " + out.slice(0, 200)));
        });
      }
    );
    req.setTimeout(15000, () => req.destroy(new Error("Twilio timed out")));
    req.on("error", reject);
    req.end(data);
  });
}

module.exports = { configured, send };
