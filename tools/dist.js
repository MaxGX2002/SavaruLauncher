// Packages the launcher into dist/Savaru IV Launcher-win32-x64 and zips it:  npm run dist
// ponytail: portable zip, no installer; add electron-builder/NSIS when players need Start-menu shortcuts.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { packager } = require('@electron/packager');

const root = path.join(__dirname, '..');
const pkg = require('../package.json');
const cfg = require('../app/config.json');
if (!cfg.feedUrl) console.warn('WARNING: app/config.json feedUrl is empty - this build cannot find the pack.');
if (!cfg.msaClientId) console.warn('WARNING: app/config.json msaClientId is empty - this build cannot sign in.');

// Windows wants an .ico; a single 256px PNG inside an ICO container is valid since Vista.
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
const png = fs.readFileSync(path.join(root, 'app', 'img', 'icon.png'));
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
head[6] = 0; head[7] = 0; head[8] = 0; head[9] = 0;
head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
const ico = path.join(root, 'build', 'icon.ico');
fs.writeFileSync(ico, Buffer.concat([head, png]));

(async () => {
  const [out] = await packager({
    // DIST_OUT: build elsewhere while a player copy is still running from dist/ (its files are locked).
    dir: root, out: process.env.DIST_OUT || path.join(root, 'dist'), overwrite: true, asar: true,
    platform: 'win32', arch: 'x64',
    name: pkg.productName, executableName: 'SavaruLauncher', appVersion: pkg.version, icon: ico,
    win32metadata: { CompanyName: 'Savaru', FileDescription: pkg.productName, ProductName: pkg.productName, InternalName: 'SavaruLauncher' },
    ignore: [/^\/(feed|tools|dist|build|docs)(\/|$)/, /^\/\.git/],
    prune: true,
  });
  const zip = path.join(path.dirname(out), `SavaruLauncher-${pkg.version}-win64.zip`);
  fs.rmSync(zip, { force: true });
  // Windows' own bsdtar: Git's GNU tar on PATH reads "C:" as a remote host.
  execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-a', '-cf', zip, '-C', path.dirname(out), path.basename(out)]);
  console.log(`built ${out}\nzipped ${zip} (${(fs.statSync(zip).size / 1048576).toFixed(0)} MB)`);
  // For feed/launcher-release.json "download", which running launchers use to update themselves.
  const sha1 = require('crypto').createHash('sha1').update(fs.readFileSync(zip)).digest('hex');
  console.log(`download: ${JSON.stringify({ sha1, size: fs.statSync(zip).size })}`);
})().catch(e => { console.error(e); process.exit(1); });
