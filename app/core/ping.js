// Minecraft server list ping (status request), the same thing the multiplayer screen does.
const net = require('net');
const dns = require('dns').promises;

function varint(n) {
  const out = [];
  do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n);
  return Buffer.from(out);
}
const packet = (...parts) => { const body = Buffer.concat(parts); return Buffer.concat([varint(body.length), body]); };

function readVarint(buf, pos) {
  let n = 0, shift = 0, b;
  do { if (pos >= buf.length) return null; b = buf[pos++]; n |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
  return [n >>> 0, pos];
}

// Addresses without a port use the _minecraft._tcp SRV record (playit.gg tunnels live on one), like the
// game does. Some machines point Node at a resolver that refuses SRV queries, so public DNS is the fallback.
async function locate(address) {
  const [host, p] = address.split(':');
  if (p || net.isIP(host)) return [host, Number(p) || 25565];
  const pub = new dns.Resolver({ timeout: 3000, tries: 1 });
  pub.setServers(['1.1.1.1', '8.8.8.8']);
  for (const r of [dns, pub]) {
    try { const [s] = await r.resolveSrv('_minecraft._tcp.' + host); if (s) return [s.name, s.port]; } catch {}
  }
  return [host, 25565];
}

async function ping(address, timeoutMs = 5000) {
  const [host, port] = await locate(address);
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const sock = net.connect({ host, port });
    let buf = Buffer.alloc(0);
    const fail = e => { sock.destroy(); reject(e); };
    sock.setTimeout(timeoutMs, () => fail(new Error('timeout')));
    sock.on('error', fail);
    sock.on('connect', () => {
      const h = Buffer.from(host);
      const p = Buffer.alloc(2); p.writeUInt16BE(port);
      sock.write(packet(varint(0), varint(767), varint(h.length), h, p, varint(1)));
      sock.write(packet(varint(0)));
    });
    sock.on('data', d => {
      buf = Buffer.concat([buf, d]);
      const len = readVarint(buf, 0); if (!len) return;
      if (buf.length < len[1] + len[0]) return;
      const id = readVarint(buf, len[1]); const sl = readVarint(buf, id[1]);
      const json = JSON.parse(buf.toString('utf8', sl[1], sl[1] + sl[0]));
      sock.destroy();
      resolve({ online: json.players?.online ?? 0, max: json.players?.max ?? 0, version: json.version?.name, ms: Date.now() - started });
    });
  });
}

module.exports = { ping };
