import { open } from "lmdb";

import path from "path";
import crypto from "crypto";

export class DB {
  constructor(dbPath, compression = true, mapSize = 1024 * 1024 * 1024) {
    this.basekey = crypto.createHash("sha256").update(`primarydbkey|${dbPath}`).digest("hex");
    this.queue = [];
    this.server = open({ path: path.resolve("./" + dbPath), compression, mapSize });
  }

  write(key, value) { this.queue.push({ key, value }); }

  commit({ throwOnError = false } = {}) {
    if (!this.queue.length) return;
    const batch = [...this.queue];
    this.queue = [];

    try {
      this.server.transactionSync(() => {
        batch.forEach(({ key, value }) => this.server.put(key, value));
      });
    } catch (err) {
      this.queue.unshift(...batch);
      if (throwOnError) { throw err; }
    }
  }

  read(key) { return this.server.get(key); }
  readMany(keys = []) { return this.server.getMany(keys); }
  readRange(startKey, endKey) { return [...this.server.getRange({ start: startKey, end: endKey })]; }
  readRangeLimit(startKey, limit = 10) { return [...this.server.getRange({ start: startKey, limit })]; }
  exists(key) { return this.server.doesExist(key); }
  remove(key) { return this.server.remove(key); }
  count() { return [...this.server.getRange()].length; }
  iterate(cb) { for (const { key, value } of this.server.getRange()) cb(key, value); }
  update(key, fn) { this.server.put(key, fn(this.server.get(key) || {})); }
}
