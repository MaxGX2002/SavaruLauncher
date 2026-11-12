// Dev check: launch the scratch install offline.  node tools/dev-launch.js <base> [server]
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const game = require('../app/core/game');
const feed = require('../feed/launcher.json');
const name = 'DevTester';
const cmd = game.launchCommand(process.argv[2], feed, { name, uuid: game.offlineUuid(name), token: '0', type: 'legacy' }, { memoryMb: 8192, server: process.argv[3] });
const out = fs.openSync(path.join(process.argv[2], 'dev-launch.log'), 'w');
const p = spawn(cmd.java.replace('javaw.exe', 'java.exe'), cmd.args, { cwd: cmd.cwd, detached: true, stdio: ['ignore', out, out] });
p.unref();
console.log('pid', p.pid);
