// Turns website bookings into Jobber records: client + address, then a request with a scheduled assessment.
// Does nothing (and never breaks the site) when Jobber is not connected.
const crypto = require("crypto");
const jobber = require("./jobber");
const sms = require("./sms");
const mail = require("./mail");
const photos = require("./photos");

// Tracking links are signed, so they work without a database and survive restarts.
const SECRET = process.env.TRACK_SECRET || process.env.JOBBER_CLIENT_SECRET || process.env.SITE_PASSWORD || "dev-only";
const sign = (s) => crypto.createHmac("sha256", SECRET).update(s).digest("base64url").slice(0, 22);
function makeToken(d) {
  const body = Buffer.from(JSON.stringify(d)).toString("base64url");
  return body + "." + sign(body);
}
function readToken(t) {
  const [body, sig] = String(t || "").split(".");
  if (!body || !sig || sig.length !== 22 || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(body)))) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()); } catch (e) { return null; }
}

const TIMEZONE = process.env.BIZ_TIMEZONE || "America/New_York";
const pending = new Map(); // phone digits -> lead details from the first step
const booked = new Map(); // phone digits -> { clientId, phoneId } after the time is locked

const digits = (p) => String(p || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

// "412 Frederick Rd, Catonsville, MD 21228" -> address parts. Missing city/state default to our service area.
function parseAddress(text) {
  const parts = String(text || "").split(",").map((s) => s.trim()).filter(Boolean);
  const out = { street1: parts[0] || text, city: "Catonsville", province: "MD", country: "US" };
  if (parts[1]) out.city = parts[1];
  const st = /^([A-Za-z]{2})\b\s*(\d{5})?/.exec(parts[2] || "");
  if (st) { out.province = st[1].toUpperCase(); if (st[2]) out.postalCode = st[2]; }
  const zip = /\b(\d{5})\b/.exec(parts.slice(1).join(" "));
  if (zip && !out.postalCode) out.postalCode = zip[1];
  return out;
}

// "8–10 AM", "10 AM–12 PM", "12–2 PM" -> ["08:00:00", "10:00:00"]
function parseWindow(slot) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i.exec(slot || "");
  if (!m) return null;
  const to24 = (h, min, ap) => {
    h = Number(h) % 12;
    if (/pm/i.test(ap)) h += 12;
    return String(h).padStart(2, "0") + ":" + (min || "00") + ":00";
  };
  const endAp = m[6];
  let startAp = m[3] || endAp;
  if (!m[3] && Number(m[1]) % 12 > Number(m[4]) % 12 && /pm/i.test(endAp)) startAp = "AM"; // e.g. 11-1 PM
  return [to24(m[1], m[2], startAp), to24(m[4], m[5], endAp)];
}

function rememberLead(r) {
  pending.set(digits(r.phone), { ...r, at: Date.now() });
  for (const [k, v] of pending) if (Date.now() - v.at > 6 * 3600 * 1000) pending.delete(k); // forget old ones
  return "remembered details for " + digits(r.phone);
}

const publicBase = () => (process.env.PUBLIC_URL || (process.env.JOBBER_REDIRECT_URI || "").replace(/\/jobber\/.*$/, "")).replace(/\/$/, "");
const niceDay = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
// The booking confirmation email: always sent, since email is required to book.
async function sendBookedEmail(x) {
  const base = publicBase();
  if (!base) return "skipped (no public address)";
  const link = base + "/t/" + x.token;
  const what = String(x.service || "service").toLowerCase() + " visit on " + niceDay(x.date) + ", " + x.slot;
  return mail.send(x.email, "You're booked with Optimus Garage",
    "You're booked: " + what + ".\n\nFollow your appointment live (and change or cancel it) here:\n" + link + "\n\nWe'll text or email you when we're on the way.\n\nOptimus Garage Company",
    "<div style=\"font-family:Arial,sans-serif;color:#0A1A3A;max-width:480px\"><h2 style=\"margin:0 0 8px\">You're booked!</h2><p style=\"font-size:16px\">" + what + "</p><p><a href=\"" + link + "\" style=\"display:inline-block;background:#F5CB45;color:#0A1A3A;font-weight:800;padding:14px 22px;border:3px solid #0A1A3A;text-decoration:none\">Follow my appointment</a></p><p style=\"color:#4B5668\">You can change or cancel from that page. We'll text or email you when we're on the way.</p><p>Optimus Garage Company</p></div>");
}

async function bookTime(s) {
  if (!jobber.connected()) return "skipped (Jobber not connected)";
  const key = digits(s.phone);
  const lead = pending.get(key);
  if (!lead) return "skipped (no details found for this phone)";
  const win = parseWindow(s.slot);
  if (!win) return "skipped (could not read time window: " + s.slot + ")";

  const names = lead.name.trim().split(/\s+/);
  const firstName = names[0];
  const lastName = names.slice(1).join(" ") || "-";
  const created = await jobber.gql(
    `mutation($input: ClientCreateInput!){ clientCreate(input:$input){ client{ id phones{ id } clientProperties{ nodes{ id } } } userErrors{ message path } } }`,
    { input: {
        firstName, lastName,
        phones: [{ number: lead.phone, description: "MOBILE", primary: true, smsAllowed: false }],
        emails: lead.email ? [{ address: lead.email, description: "MAIN", primary: true }] : undefined,
        properties: [{ address: parseAddress(lead.address) }],
        sourceAttribution: { sourceText: "Optimus Garage website" },
    } }
  );
  const cc = created.clientCreate;
  if (cc.userErrors && cc.userErrors.length) throw new Error("clientCreate: " + cc.userErrors.map((e) => e.message).join("; "));
  const client = cc.client;
  const propertyId = client.clientProperties.nodes[0].id;

  const at = (time) => ({ date: s.date, time, timezone: TIMEZONE });
  const req = await jobber.gql(
    `mutation($input: RequestCreateInput!){ requestCreate(input:$input){ request{ id title } userErrors{ message path } } }`,
    { input: {
        clientId: client.id,
        propertyId,
        title: lead.service + (lead.note ? " | " + lead.note.slice(0, 120) : "") + " | Website booking",
        assessment: {
          instructions: "Arrival window " + s.slot + ". " + (lead.note || ""),
          schedule: { startAt: at(win[0]), endAt: at(win[1]), notifyTeam: true },
        },
    } }
  );
  const rc = req.requestCreate;
  if (rc.userErrors && rc.userErrors.length) throw new Error("requestCreate: " + rc.userErrors.map((e) => e.message).join("; "));
  const token = makeToken({ r: rc.request.id, a: lead.address, s: lead.service, d: s.date, w: s.slot, c: client.id, p: client.phones && client.phones[0] ? client.phones[0].id : null, n: lead.phone });
  booked.set(key, { requestId: rc.request.id, clientId: client.id, phoneId: client.phones && client.phones[0] ? client.phones[0].id : null,
    token, phone: lead.phone, service: lead.service, date: s.date, slot: s.slot });
  let photoNote = "";
  const urls = String(s.photos || "").split(",").map((x) => photos.url(x)).filter(Boolean);
  if (urls.length) {
    try {
      await jobber.gql(
        `mutation($id: EncodedId!, $input: RequestCreateNoteInput!){ requestCreateNote(requestId:$id, input:$input){ userErrors{ message } } }`,
        { id: rc.request.id, input: { message: "Photos from the customer (website booking)", attachments: urls.map((u) => ({ url: u })) } }
      );
      photoNote = " + " + urls.length + " photo(s)";
    } catch (e) { photoNote = " (photos failed: " + e.message + ")"; }
  }
  let emailed = "";
  if (lead.email) {
    try { emailed = " | " + (await sendBookedEmail({ email: lead.email, token, service: lead.service, date: s.date, slot: s.slot })); }
    catch (e) { emailed = " | email failed: " + e.message; }
  }
  return { log: "created client + request " + rc.request.id + " scheduled " + s.date + " " + win[0] + "-" + win[1] + photoNote + emailed, token };
}

async function updatePrefs(p) {
  if (!jobber.connected()) return "skipped (Jobber not connected)";
  let b = booked.get(digits(p.phone));
  if (!b && p.t) {
    const t = readToken(p.t);
    if (t) b = { clientId: t.c, phoneId: t.p, token: p.t, phone: t.n, service: t.s, date: t.d, slot: t.w };
  }
  if (!b || !b.clientId) return "skipped (no Jobber client for this phone)";
  const input = {};
  if (p.channel === "text" && b.phoneId) input.phonesToEdit = [{ id: b.phoneId, smsAllowed: true }];
  let texted = "";
  if (p.channel === "text" && b.token) {
    // Text the tracking link only if they chose texts. (The email always goes out at booking.)
    const base = publicBase();
    if (base) {
      const what = String(b.service || "service").toLowerCase() + " visit (" + niceDay(b.date) + ", " + b.slot + ")";
      try { texted = " | " + await sms.send(b.phone, "Optimus Garage: you're booked! " + what.charAt(0).toUpperCase() + what.slice(1) + ". Follow it live: " + base + "/t/" + b.token + "  Reply STOP to opt out."); }
      catch (e) { texted = " | text failed: " + e.message; }
    }
  }
  if (!Object.keys(input).length) return "nothing to update" + texted;
  const r = await jobber.gql(
    `mutation($id: EncodedId!, $input: ClientEditInput!){ clientEdit(clientId:$id, input:$input){ client{ id } userErrors{ message path } } }`,
    { id: b.clientId, input }
  );
  const errs = r.clientEdit.userErrors;
  if (errs && errs.length) throw new Error("clientEdit: " + errs.map((e) => e.message).join("; "));
  return "updated client contact preference (" + p.channel + ")" + texted;
}

// Where is this customer's appointment right now? Read live from Jobber.
// step 0 = received, 1 = confirmed by the customer, 3 = assessment finished. (Jobber's API has no "on the way" signal.)
async function statusOf(requestId) {
  const d = await jobber.gql(
    `query($id: EncodedId!){ request(id:$id){ id title assessment{ id startAt endAt clientConfirmed isComplete completedAt } } }`,
    { id: requestId }
  );
  const a = (d.request && d.request.assessment) || {};
  let step = 1; // booked = confirmed: the customer picked a real open window
  if (a.isComplete) step = 3;
  const cancelled = /^CANCELLED/.test((d.request && d.request.title) || "");
  return { known: true, cancelled, step, startAt: a.startAt || null, endAt: a.endAt || null, confirmed: !!a.clientConfirmed, complete: !!a.isComplete };
}
async function status(phone) {
  const b = booked.get(digits(phone));
  if (!b || !b.requestId || !jobber.connected()) return { known: false };
  return statusOf(b.requestId);
}
// Same, for a customer's tracking link. Also returns the details to show on the page.
async function statusByToken(token) {
  const t = readToken(token);
  if (!t || !jobber.connected()) return { known: false };
  const s = await statusOf(t.r);
  return { ...s, address: t.a, service: t.s, date: t.d, slot: t.w, review: process.env.REVIEW_URL || "" };
}


// ---------- real availability, read from Jobber's schedule ----------
const WINDOWS = [8, 10, 12, 14]; // start hours; each window is 2 hours (matches the site)
const CAPACITY = Number(process.env.SLOT_CAPACITY || 1); // how many appointments can overlap one window
const partsIn = (iso) => {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const o = {};
  f.formatToParts(new Date(iso)).forEach((p) => (o[p.type] = p.value));
  return { day: o.year + "-" + o.month + "-" + o.day, h: Number(o.hour) + Number(o.minute) / 60 };
};
let avCache = { key: "", at: 0, val: null };
async function availability(from, to) {
  if (!jobber.connected()) return { ok: false };
  const key = from + "|" + to;
  if (avCache.key === key && Date.now() - avCache.at < 30000) return avCache.val;
  const d = await jobber.gql(
    `query($f: ISO8601DateTime!, $t: ISO8601DateTime!){ scheduledItems(first: 100, filter:{ includeUnassigned: true, occursWithin:{ startAt:$f, endAt:$t } }){ nodes{ startAt endAt allDay } } }`,
    { f: from + "T00:00:00-05:00", t: to + "T23:59:59-04:00" }
  );
  const counts = {};
  ((d.scheduledItems && d.scheduledItems.nodes) || []).forEach((n) => {
    if (!n.startAt || !n.endAt) return;
    const a = partsIn(n.startAt), z = partsIn(n.endAt);
    const days = a.day === z.day ? [[a.day, a.h, z.h]] : [[a.day, a.h, 24], [z.day, 0, z.h]];
    if (n.allDay) days.forEach((x) => { x[1] = 0; x[2] = 24; });
    days.forEach(([day, s, e]) => WINDOWS.forEach((w, i) => {
      if (s < w + 2 && e > w) { counts[day] = counts[day] || {}; counts[day][i] = (counts[day][i] || 0) + 1; }
    }));
  });
  const taken = {};
  Object.keys(counts).forEach((day) => {
    const list = Object.keys(counts[day]).filter((i) => counts[day][i] >= CAPACITY).map(Number);
    if (list.length) taken[day] = list;
  });
  const val = { ok: true, taken, seen: ((d.scheduledItems && d.scheduledItems.nodes) || []).length };
  avCache = { key, at: Date.now(), val };
  return val;
}

// Move the customer's appointment to a new day and window (from their tracking page).
async function reschedule(token, date, slot) {
  const t = readToken(token);
  if (!t || !jobber.connected()) throw new Error("bad link");
  const win = parseWindow(slot);
  if (!win || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("bad time");
  const idx = ["8–10 AM", "10 AM–12 PM", "12–2 PM", "2–4 PM"].indexOf(slot);
  const av = await availability(date, date);
  if (av.ok && idx >= 0 && (av.taken[date] || []).includes(idx)) return { ok: false, error: "That window was just taken. Please pick another." };
  const cur = await jobber.gql(`query($id: EncodedId!){ request(id:$id){ assessment{ id } } }`, { id: t.r });
  const aid = cur.request && cur.request.assessment && cur.request.assessment.id;
  if (!aid) throw new Error("no assessment");
  const at = (time) => ({ date, time, timezone: TIMEZONE });
  const r = await jobber.gql(
    `mutation($id: EncodedId!, $input: AssessmentEditInput!){ assessmentEdit(assessmentId:$id, input:$input){ assessment{ id } userErrors{ message } } }`,
    { id: aid, input: { schedule: { startAt: at(win[0]), endAt: at(win[1]), notifyTeam: true } } }
  );
  const errs = r.assessmentEdit.userErrors;
  if (errs && errs.length) throw new Error("assessmentEdit: " + errs.map((e) => e.message).join("; "));
  avCache = { key: "", at: 0, val: null };
  await note(t.r, "Customer rescheduled from the website to " + date + ", " + slot + ".");
  const nt = makeToken({ ...t, d: date, w: slot });
  return { ok: true, token: nt };
}

async function note(requestId, message) {
  try {
    await jobber.gql(`mutation($id: EncodedId!, $input: RequestCreateNoteInput!){ requestCreateNote(requestId:$id, input:$input){ userErrors{ message } } }`, { id: requestId, input: { message } });
  } catch (e) { console.log("Jobber note error: " + e.message); }
}

// One tap on the tracking page: mark the visit confirmed in Jobber (title tag + note for the team).
async function confirm(token) {
  const t = readToken(token);
  if (!t || !jobber.connected()) throw new Error("bad link");
  const cur = await jobber.gql(`query($id: EncodedId!){ request(id:$id){ title } }`, { id: t.r });
  const title = (cur.request && cur.request.title) || "Website booking";
  if (!/CONFIRMED by customer/.test(title)) {
    await jobber.gql(`mutation($id: EncodedId!, $input: RequestEditInput!){ requestEdit(requestId:$id, input:$input){ userErrors{ message } } }`, { id: t.r, input: { title: "CONFIRMED by customer | " + title } });
    await note(t.r, "Customer confirmed the appointment from the website (" + t.d + ", " + t.w + ").");
  }
  return { ok: true };
}

// Cancel from the tracking page: free the calendar slot and mark the request cancelled.
async function cancel(token) {
  const t = readToken(token);
  if (!t || !jobber.connected()) throw new Error("bad link");
  const cur = await jobber.gql(`query($id: EncodedId!){ request(id:$id){ title assessment{ id } } }`, { id: t.r });
  const rq = cur.request || {};
  if (rq.assessment && rq.assessment.id) {
    await jobber.gql(`mutation($id: EncodedId!){ assessmentDelete(assessmentId:$id){ userErrors{ message } } }`, { id: rq.assessment.id });
  }
  if (!/^CANCELLED/.test(rq.title || "")) {
    await jobber.gql(`mutation($id: EncodedId!, $input: RequestEditInput!){ requestEdit(requestId:$id, input:$input){ userErrors{ message } } }`, { id: t.r, input: { title: "CANCELLED - " + (rq.title || "Website booking") } });
  }
  await note(t.r, "Customer cancelled from the website.");
  avCache = { key: "", at: 0, val: null };
  return { ok: true };
}

module.exports = { availability, reschedule, cancel, confirm, status, statusByToken, readToken, rememberLead, bookTime, updatePrefs, parseWindow, parseAddress };
