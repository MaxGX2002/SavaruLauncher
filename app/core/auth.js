// Microsoft account -> Xbox Live -> Minecraft, via the OAuth device-code flow (no embedded browser,
// the player signs in on microsoft.com/link). Needs an Azure app id that Mojang has approved for
// the Minecraft API; without approval the last step answers 403 "Invalid app registration".
const UA = require('./util').UA;
const MS = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const SCOPE = 'XboxLive.signin offline_access';

async function post(url, body, form) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: form ? new URLSearchParams(body) : JSON.stringify(body),
  });
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch { j = { raw: text }; }
  return { ok: res.ok, status: res.status, j };
}

// Step 1: returns { user_code, verification_uri, device_code, interval, expires_in }.
async function startDeviceLogin(clientId) {
  const r = await post(`${MS}/devicecode`, { client_id: clientId, scope: SCOPE }, true);
  if (!r.ok) throw new Error(r.j.error_description || `device code HTTP ${r.status}`);
  return r.j;
}

// Step 2: polls until the player finishes signing in; returns the Microsoft tokens.
async function pollDeviceLogin(clientId, dc, isCancelled = () => false) {
  let wait = (dc.interval || 5) * 1000;
  const until = Date.now() + (dc.expires_in || 900) * 1000;
  while (Date.now() < until) {
    await new Promise(r => setTimeout(r, wait));
    if (isCancelled()) throw new Error('cancelled');
    const r = await post(`${MS}/token`, { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: clientId, device_code: dc.device_code }, true);
    if (r.ok) return r.j;
    if (r.j.error === 'authorization_pending') continue;
    if (r.j.error === 'slow_down') { wait += 5000; continue; }
    throw new Error(r.j.error_description || r.j.error || `token HTTP ${r.status}`);
  }
  throw new Error('expired');
}

async function refresh(clientId, refreshToken) {
  const r = await post(`${MS}/token`, { grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken, scope: SCOPE }, true);
  if (!r.ok) throw new Error(r.j.error_description || `refresh HTTP ${r.status}`);
  return r.j;
}

const XSTS_ERRORS = {
  2148916233: 'no_xbox_profile', // account has no Xbox profile yet
  2148916238: 'child_account',
  2148916235: 'region_blocked',
};

// Step 3: Microsoft access token -> Minecraft session { name, uuid, token, xuid, expiresAt }.
async function minecraftLogin(msAccessToken) {
  const xbl = await post('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: 'd=' + msAccessToken },
    RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT',
  });
  if (!xbl.ok) throw new Error(`xbox_auth_${xbl.status}`);
  const uhs = xbl.j.DisplayClaims.xui[0].uhs;
  const xsts = await post('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.j.Token] },
    RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT',
  });
  if (!xsts.ok) throw new Error(XSTS_ERRORS[xsts.j.XErr] || `xsts_${xsts.status}`);
  const mc = await post('https://api.minecraftservices.com/authentication/login_with_xbox', { identityToken: `XBL3.0 x=${uhs};${xsts.j.Token}` });
  if (!mc.ok) throw new Error(mc.status === 403 ? 'app_not_approved' : `minecraft_login_${mc.status}`);
  const prof = await fetch('https://api.minecraftservices.com/minecraft/profile', { headers: { Authorization: 'Bearer ' + mc.j.access_token, 'User-Agent': UA } });
  if (prof.status === 404) throw new Error('no_minecraft');
  if (!prof.ok) throw new Error(`profile_${prof.status}`);
  const p = await prof.json();
  const xuid = xsts.j.DisplayClaims?.xui?.[0]?.xid || '0';
  return { name: p.name, uuid: p.id, token: mc.j.access_token, xuid, type: 'msa', expiresAt: Date.now() + (mc.j.expires_in || 86400) * 1000 };
}

module.exports = { startDeviceLogin, pollDeviceLogin, refresh, minecraftLogin };
