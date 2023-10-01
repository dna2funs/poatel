const i_ws = require('ws');
const i_axios = require('axios');

const env = {
   target: process.env.PUB_URL,
   ws: null,
   connN: 0,
   ticket: {},
};

function safeClose(ws) {
   if (!ws) return;
   try { ws.terminate() } catch(err) { }
}
function safeSend(ws, buf) {
   if (!ws) return;
   if (ws.readyState !== i_ws.WebSocket.OPEN) return;
   try { ws.send(buf); } catch(err) { }
}
function safeSendJson(ws, json) {
   safeSend(ws, JSON.stringify(json));
}

async function build(method, uri, payload) {
   console.log('[I]', new Date().toISOString(), method, uri, payload);
   const url = `http://127.0.0.1:8080${uri}`;

   if (method === 'POST') {
      return await i_axios(url, payload);
   } else {
      return await i_axios(url);
   }
}

function connect() {
   console.log(`[I] connecting to "${env.target}" ...`);
   try {
      const ws = new i_ws.WebSocket(env.target);
      env.ws = ws;
      ws.on('open', () => {
         console.log(`[I] connected.`);
         safeSendJson(ws, { cmd: 'auth' });
      });
      ws.on('error', (err) => {
         console.log('[E]', err);
         env.ws = null;
      });
      ws.on('close', () => {
         console.log('[I] disconnected');
         env.ws = null;
      });
      ws.on('message', async (data) => {
         if (!data || data.length > 10*1024 /* 10K */) {
            return;
         }
         try { data = JSON.parse(data); } catch (err) { data = {}; }
         if (data.rpl === 'auth') {
            safeSendJson(ws, { cmd: 'register', region: 'hello' });
            console.log(`[I] registered as 'hello' ...`);
            return;
         }
         if (data.cmd === 'req') {
            const id = data.id;
            const method = data.opt.method;
            const payload = data.opt.payload;
            const uri = data.path;
            if (!(id >= 0) || !method || !uri) {
               safeSendJson(ws, { rpl: 'req', id, obj: { code: 400 } });
               return;
            }
            try {
               const obj = await build(method, uri, payload);
               if (!obj) throw 'error';
               const r = { rpl: 'req', id, obj: { headers: obj.headers, code: obj.status, raw: JSON.stringify(obj.data) } };
               safeSendJson(ws, r);
            } catch (err) {
               if (!err?.response?.status) console.error(`[E] ${id} - [${method}] ${uri}`, err);
               safeSendJson(ws, { rpl: 'req', id, obj: { code: err?.response?.status || 500 } });
            }
         }
      });
   } catch (err) { }
}

function watchDog() {
   try {
      if (!env.ws) connect();
   } catch(err) { }
   setTimeout(watchDog, 10*1000);
}

watchDog();
