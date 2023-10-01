const Task = require('./task');

class Route {
   constructor() {
      this.task = new Task({
         actorN: 100,
         queueMax: 1000,
      });
      this.regions = {};
   }

   register(region, one) {
      if (!this.regions[region]) this.regions[region] = [];
      if (this.regions[region].includes(one)) return false;
      this.regions[region].push(one);
      console.log(`[I] route/reg: ${region} (${this.regions[region].length}) ...`);
      return true;
   }

   unregister(region, one) {
      if (!this.regions[region]) return false;
      const i = this.regions[region].indexOf(one);
      if (i < 0) return false;
      this.regions[region].splice(i, 1);
      console.log(`[I] route/unreg: ${region} (${this.regions[region].length}) ...`);
      return true;
   }

   async req(region, path, opt) {
      // TODO: more complex load balance
      const regionItem = this.regions[region]?.[0];
      if (!regionItem) {
         return null;
      }
      try {
         const ret = await this.task.req(async (id, args) => {
            try {
               return await regionItem.req(id, args);
            } catch (err) {
               console.error(`[E] ${region}: ${path}`, err);
               return null;
            }
         }, { region, path, opt });
         console.log(`[I] ${region}: ${path}`);
         return ret;
      } catch (err) {
         console.error(`[E] ${region}: ${path}`, err);
         return null;
      }
   }
}

module.exports = Route;
