// Jobber connection: sign-in (OAuth), token refresh, and a small GraphQL helper.
// No packages needed. Everything is off until JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET are set.
//
// Environment variables:
//   JOBBER_CLIENT_ID, JOBBER_CLIENT_SECRET   from your app in the Jobber Developer Center
//   JOBBER_REDIRECT_URI                      e.g. https://optimus-garage-site.onrender.com/jobber/callback
//   JOBBER_REFRESH_TOKEN                     saved after the one-time connect (see /jobber/connect)
//   JOBBER_API_VERSION                       optional, sent as X-JOBBER-GRAPHQL-VERSION when set
const fs = require("fs");
const path = require("path");
const https = require("https");

const CLIENT_ID = process.env.JOBBER_CLIENT_ID || "";
const CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.JOBBER_REDIRECT_URI || "";
const API_VERSION = process.env.JOBBER_API_VERSION || "";
const TOKEN_FILE = path.join(__dirname, "jobber-token.json");

let refreshToken = process.env.JOBBER_REFRESH_TOKEN || "";
try {
  if (!refreshToken) refreshToken = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")).refresh_token || "";
} catch (e) {}
let accessToken = "";
let accessExpires = 0;

const configured = () => !!(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
const connected = () => configured() && !!refreshToken;

function request(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, json, text: data });
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error("Jobber request timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function authorizeUrl(state) {
  const q = new URLSearchParams({ response_type: "code", client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, state });
  return "https://api.getjobber.com/api/oauth/authorize?" + q;
}

async function tokenRequest(params) {
  const body = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }).toString();
  const res = await request("https://api.getjobber.com/api/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
    body,
  });
  if (res.status !== 200 || !res.json || !res.json.access_token) {
    throw new Error("Jobber token request failed (" + res.status + ")");
  }
  accessToken = res.json.access_token;
  accessExpires = Date.now() + 55 * 60 * 1000; // tokens last 60 minutes; refresh a little early
  if (res.json.refresh_token) {
    // If refresh-token rotation is on, Jobber hands back a new one each time and the old one stops working.
    if (res.json.refresh_token !== refreshToken) {
      refreshToken = res.json.refresh_token;
      try { fs.writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: refreshToken }), { mode: 0o600 }); } catch (e) {}
      if (process.env.JOBBER_REFRESH_TOKEN) {
        console.log("Jobber gave a new refresh token. Update JOBBER_REFRESH_TOKEN, or turn off token rotation in the Developer Center.");
      }
    }
  }
  return res.json;
}

// Trade the one-time code from the sign-in redirect for tokens.
function exchangeCode(code) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
}

async function getAccessToken() {
  if (!connected()) throw new Error("Jobber is not connected");
  if (accessToken && Date.now() < accessExpires) return accessToken;
  await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  return accessToken;
}

// Run a GraphQL query or mutation. Throws on network, auth or GraphQL errors.
async function gql(query, variables) {
  const token = await getAccessToken();
  const body = JSON.stringify({ query, variables: variables || {} });
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + token, "Content-Length": Buffer.byteLength(body) };
  if (API_VERSION) headers["X-JOBBER-GRAPHQL-VERSION"] = API_VERSION;
  const res = await request("https://api.getjobber.com/api/graphql", { method: "POST", headers, body });
  if (res.status === 401) accessToken = ""; // force a refresh next time
  if (res.status !== 200 || !res.json) throw new Error("Jobber API error (" + res.status + ")");
  if (res.json.errors && res.json.errors.length) throw new Error("Jobber: " + res.json.errors.map((e) => e.message).join("; "));
  return res.json.data;
}

// Look up the fields of a GraphQL type, so we can see exactly what Jobber accepts.
function describeType(name) {
  return gql(
    `query($n:String!){__type(name:$n){name kind fields{name args{name type{...T}} type{...T}} inputFields{name type{...T}} enumValues{name}}}
     fragment T on __Type{kind name ofType{kind name ofType{kind name ofType{kind name}}}}`,
    { n: name }
  );
}

module.exports = { configured, connected, authorizeUrl, exchangeCode, gql, describeType };
