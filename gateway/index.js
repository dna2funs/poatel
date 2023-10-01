// version 1.0.1

const i_fs = require('fs');
const i_path = require('path');
const i_url = require('url');
const i_crypto = require('crypto');
const i_config = require('./config');

const i_env = {
   debug: !!i_config.TINY_DEBUG,
   server: {
      host: i_config.TINY_HOST,
      port: i_config.TINY_PORT,
      httpsCADir: i_config.TINY_HTTPS_CA_DIR,
      maxPayload: i_config.TINY_MAX_PAYLOAD,
   },
};

function readRequestBinary(req) {
   return new Promise((resolve, reject) => {
      let size = 0;
      let over = false;
      const body = [];
      req.on('data', (chunk) => {
         if (over) return;
         size += chunk.length;
         if (size > i_env.server.maxPayload) {
            over = true;
            reject(new Error('payload too large'));
            return;
         }
         body.push(chunk);
      });
      req.on('end', () => {
         if (over) return;
         const bodyraw = Buffer.concat(body).toString();
         resolve(bodyraw);
      })
   });
}

function basicRoute (req, res, router) {
   const r = i_url.parse(req.url);
   const originPath = r.pathname.split('/');
   const path = originPath.slice();
   const query = {};
   let f = router;
   if (r.query) r.query.split('&').forEach((one) => {
      let key, val;
      let i = one.indexOf('=');
      if (i < 0) {
         key = one;
         val = '';
      } else {
         key = one.substring(0, i);
         val = one.substring(i+1);
      }
      if (key in query) {
         if(Array.isArray(query[key])) {
            query[key].push(val);
         } else {
            query[key] = [query[key], val];
         }
      } else {
         query[key] = val;
      }
   });
   path.shift();
   while (path.length > 0) {
      let key = path.shift();
      f = f[key];
      if (!f || key === 'constructor') break;
      if (typeof(f) === 'function') {
         return f(req, res, {
            path: path,
            query: query
         });
      }
   }
   return serveCode(req, res, 404, 'Not Found');
}

function serveCode(req, res, code, text) {
   res.writeHead(code || 500, text || '');
   res.end();
}

function createServer(router) {
   let server = null;
   router = Object.assign({}, router);
   if (i_env.server.httpsCADir) {
      const i_https = require('https');
      const https_config = {
         // openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 -keyout ca.key -out ca.crt
         key: i_fs.readFileSync(i_path.join(i_env.server.httpsCADir, 'ca.key')),
         cert: i_fs.readFileSync(i_path.join(i_env.server.httpsCADir, 'ca.crt')),
      };
      server = i_https.createServer(https_config, (req, res) => {
         basicRoute(req, res, router);
      });
   } else {
      const i_http = require('http');
      server = i_http.createServer((req, res) => {
         basicRoute(req, res, router);
      });
   }
   return server;
}

const server = createServer({
   test: (_req, res, options) => {
      res.end(JSON.stringify({
         text: 'hello world',
         path: `/${options.path.join('/')}`
      }));
   },
   api: {
      gw: async (req, res, opt) => {
         const ps = req.url.split('/');
         // [0], [1] = api, [2] = gw, [3] = <region>, [3] ...
         const region = ps[3];
         if (!region) { res.writeHead(404); res.end(); }
         try {
            const path = `/${ps.slice(4).join('/')}`;
            const inbuf = await readRequestBinary(req);
            const ret = await i_route.req(region, path, {
               method: req.method,
               headers: req.headers,
               payload: inbuf ? inbuf.toString('binary') : null,
            });
            const outbuf = ret?.raw ? Buffer.from(ret.raw, 'binary') : null;
            Object.keys(ret?.headers || {}).forEach((key) => {
               res.setHeader(key, ret.headers[key]);
            });
            res.writeHead(ret?.code || 200);
            res.end(outbuf);
         } catch(err) {
            console.error(`[E] gw: ${req.url}`, err);
            res.writeHead(500);
            res.end();
         }
      }, //gw
   }, // api
});

const i_websocket = require('./websocket');
const Route = require('./Route');
const Region = require('./Region');
const i_route = new Route();
const secret_path_name = i_config.GW_SECRET_CHANNEL || i_crypto.randomUUID();
i_websocket.makeWebsocket(server, 'channel', `/${secret_path_name}/channel`, (ws, local, m) => {
   if (!local.authenticated) {
      if (m && m.cmd === 'auth') {
         // TODO: check user
         local.authenticated = true;
         i_websocket.keepalive(ws, local);
         i_websocket.safeSendJson(ws, { rpl: 'auth' });
      }
      return;
   }
   if (m.rpl === 'req' && local.region) {
      local.region.ret(m.id, m.obj, null);
   } else if (m.cmd === 'register') {
      local.region = new Region(m.region, ws);
      i_route.register(m.region, local.region);
   } else if (m.cmd === 'unregister') {
      i_route.unregister(local.region?.name, local.region);
   }
}, {
   timeout: 5000, // if no timeout, means no need auth
   onOpen: (ws, local) => {},
   onError: (err, ws, local) => {},
   onClose: (ws, local) => {
      if (local.region) {
         i_route.unregister(local.region.name, local.region);
      }
   },
});

server.listen(i_env.server.port, i_env.server.host, () => {
   console.log(`GATEWAY is listening at ${i_env.server.host}:${i_env.server.port}`);
   if (!i_config.GW_SECRET_CHANNEL) {
      console.log(`GATEWAY secret channel: /${secret_path_name}/channel`);
   }
});
