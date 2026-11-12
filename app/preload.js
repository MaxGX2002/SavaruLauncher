const { contextBridge, ipcRenderer } = require('electron');

const CALLS = ['init', 'refresh', 'install', 'play', 'login', 'login-cancel', 'logout', 'settings', 'ping', 'open', 'link', 'copy', 'win'];
const EVENTS = ['progress', 'game', 'login-code'];

contextBridge.exposeInMainWorld('savaru', {
  call: async (ch, arg) => {
    if (!CALLS.includes(ch)) throw new Error('unknown call ' + ch);
    const r = await ipcRenderer.invoke(ch, arg);
    if (!r.ok) throw new Error(r.error);
    return r.value;
  },
  on: (ch, fn) => { if (EVENTS.includes(ch)) ipcRenderer.on(ch, (e, d) => fn(d)); },
});
