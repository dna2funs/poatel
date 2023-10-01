class Task {
   constructor(opt) {
      opt = opt || {};
      this.actorN = opt.actorN || 1;
      this.queueMax = opt.queueMax || 0;
      this.idResetN = opt.idResetN || 1000000;
      this.queue = [];
      this.autoid = 0;
   }

   async act() {
      if (!this.queue.length) return;
      if (this.actorN <= 0) return;
      this.actorN --;
      const task = this.queue.shift();
      try {
         const fn = task.fn;
         let ret = fn(task.id, task.args);
         if (ret.then && ret.catch) ret = await ret;
         task.r(ret);
      } catch(err) {
         task.e({ err, id: task.id, fn: task.fn, args: task.args });
      } finally {
         this.actorN ++;
      }
      this.act();
   }

   req(fn, args) {
      if (this.max > 0 && this.queue.length >= this.max) {
         return Promise.reject(new Error('429 too many requests'));
      }
      return new Promise((r, e) => {
         const id = this.autoid;
         this.autoid = (this.autoid + 1) % this.idResetN;
         const task = { id, fn, args, r, e };
         this.queue.push(task);
         this.act();
      });
   }
}

module.exports = Task;
