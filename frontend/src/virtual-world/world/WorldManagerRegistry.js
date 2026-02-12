/**
 * WorldManagerRegistry - central lifecycle + capability orchestration for world managers
 */

export class WorldManagerRegistry {
  constructor() {
    this.entries = [];
    this.entryMap = new Map();
  }

  register(definition) {
    const {
      name,
      manager,
      createMethod,
      getCreateArgs,
      update = true
    } = definition || {};

    if (!name || !manager) {
      throw new Error('WorldManagerRegistry.register requires both name and manager');
    }

    const entry = {
      name,
      manager,
      createMethod,
      getCreateArgs,
      update
    };

    this.entries.push(entry);
    this.entryMap.set(name, entry);
    return manager;
  }

  registerMany(definitions = []) {
    definitions.forEach((def) => this.register(def));
  }

  get(name) {
    return this.entryMap.get(name)?.manager || null;
  }

  getMap() {
    const out = {};
    this.entries.forEach(({ name, manager }) => {
      out[name] = manager;
    });
    return out;
  }

  async createAll(context = {}) {
    for (const entry of this.entries) {
      const method = entry.createMethod
        || (typeof entry.manager.create === 'function' ? 'create' : null)
        || (typeof entry.manager.init === 'function' ? 'init' : null);

      if (!method || typeof entry.manager[method] !== 'function') continue;

      const args = entry.getCreateArgs ? (entry.getCreateArgs(context) || []) : [];
      const result = entry.manager[method](...args);
      if (result && typeof result.then === 'function') {
        await result;
      }
    }
  }

  updateAll(deltaTime, worldState) {
    for (const entry of this.entries) {
      if (!entry.update) continue;
      if (typeof entry.manager.update !== 'function') continue;
      entry.manager.update(deltaTime, worldState);
    }
  }

  callAll(methodName, ...args) {
    for (const entry of this.entries) {
      const fn = entry.manager?.[methodName];
      if (typeof fn === 'function') {
        fn.call(entry.manager, ...args);
      }
    }
  }

  callSome(names = [], methodName, ...args) {
    names.forEach((name) => {
      const manager = this.get(name);
      const fn = manager?.[methodName];
      if (typeof fn === 'function') {
        fn.call(manager, ...args);
      }
    });
  }

  destroyAll() {
    [...this.entries].reverse().forEach(({ manager }) => {
      manager?.destroy?.();
    });
    this.entries = [];
    this.entryMap.clear();
  }
}
