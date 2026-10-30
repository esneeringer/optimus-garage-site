// Turns website bookings into Jobber records: client + address, then a request with a scheduled assessment.
// Does nothing (and never breaks the site) when Jobber is not connected.
const jobber = require("./jobber");

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
          schedule: { startAt: at(win[0]), endAt: at(win[1]), notifyTeam: false },
        },
    } }
  );
  const rc = req.requestCreate;
  if (rc.userErrors && rc.userErrors.length) throw new Error("requestCreate: " + rc.userErrors.map((e) => e.message).join("; "));
  booked.set(key, { requestId: rc.request.id, clientId: client.id, phoneId: client.phones && client.phones[0] ? client.phones[0].id : null });
  return "created client + request " + rc.request.id + " scheduled " + s.date + " " + win[0] + "-" + win[1];
}

async function updatePrefs(p) {
  if (!jobber.connected()) return "skipped (Jobber not connected)";
  const b = booked.get(digits(p.phone));
  if (!b) return "skipped (no Jobber client for this phone)";
  const input = {};
  if (p.channel === "email" && p.email) input.emailsToAdd = [{ address: p.email, description: "MAIN", primary: true }];
  if (p.channel === "text" && b.phoneId) input.phonesToEdit = [{ id: b.phoneId, smsAllowed: true }];
  if (!Object.keys(input).length) return "nothing to update";
  const r = await jobber.gql(
    `mutation($id: EncodedId!, $input: ClientEditInput!){ clientEdit(clientId:$id, input:$input){ client{ id } userErrors{ message path } } }`,
    { id: b.clientId, input }
  );
  const errs = r.clientEdit.userErrors;
  if (errs && errs.length) throw new Error("clientEdit: " + errs.map((e) => e.message).join("; "));
  return "updated client contact preference (" + p.channel + ")";
}

// Where is this customer's appointment right now? Read live from Jobber.
// step 0 = received, 1 = confirmed by the customer, 3 = assessment finished. (Jobber's API has no "on the way" signal.)
async function status(phone) {
  const b = booked.get(digits(phone));
  if (!b || !b.requestId || !jobber.connected()) return { known: false };
  const d = await jobber.gql(
    `query($id: EncodedId!){ request(id:$id){ id status isScheduled assessment{ startAt endAt clientConfirmed isComplete completedAt } } }`,
    { id: b.requestId }
  );
  const a = (d.request && d.request.assessment) || {};
  let step = 0;
  if (a.clientConfirmed) step = 1;
  if (a.isComplete) step = 3;
  return { known: true, step, startAt: a.startAt || null, endAt: a.endAt || null, confirmed: !!a.clientConfirmed, complete: !!a.isComplete };
}

module.exports = { status, rememberLead, bookTime, updatePrefs, parseWindow, parseAddress };
