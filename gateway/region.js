const i_events = require('events');
const Task = require('./task');
const i_websocket = require('./websocket');

class Region {
   constructor(name, ws, opt) {
      this.name = name;
      this.ws = ws;
      this.pool = {};
      this.opt = opt || {};
      this.opt.timeout = this.opt.timeout || 30000;
   }

   ret(id, obj, err) {
      const reqObj = this.pool[id];
      if (!reqObj) return;
      delete this.pool[id]; // occupy immediately
      reqObj.monitor.emit('result', { obj, err });
   }

   req(id, args) {
      return new Promise((r, e) => {
         const obj = {};
         this.pool[id] = obj;
         obj.monitor = new i_events.EventEmitter();
         obj.monitor.once('result', handleResult.bind(this));
         obj.timer = setTimeout(this.reqTimeout.bind(this), this.opt.timeout, id);
         i_websocket.safeSendJson(this.ws, { ...args, id, cmd: 'req' });
         function handleResult(item) {
            this.clr(id);
            if (item.err) return e(item.err);
            r(item.obj);
         }
      });
   }

   reqTimeout(id) {
      if (!this.pool[id]) return;
      this.ret(id, null, new Error('timeout'));
   }

   clr(id) {
      const obj = this.pool[id];
      if (!obj) return;
      if (obj.timer) clearTimeout(obj.timer);
      delete this.pool[id];
   }
}

module.exports = Region;
