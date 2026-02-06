// ==================== RELIC MANAGER ====================
const RelicManager = {
  STORAGE_KEY: 'relic-scanner-collection',

  // Generate relics.pro compatible ID
  generateId() {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 11);
    return `relic-${ts}-${rand}`;
  },

  // Create a new relic
  createRelic(color, effectIds, isDeepNight, relicName) {
    const relic = {
      id: this.generateId(),
      itemId: -1000000,
      color: color,       // "Red" | "Green" | "Blue" | "Yellow"
      dn: isDeepNight,    // boolean
      effects: effectIds,  // array of effect ID numbers
    };
    if (relicName) relic.name = relicName;
    return relic;
  },

  // Get all relics
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  // Save relic
  save(relic) {
    const relics = this.getAll();
    relics.push(relic);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(relics));
    return relics;
  },

  // Delete relic by ID
  delete(relicId) {
    let relics = this.getAll();
    relics = relics.filter(r => r.id !== relicId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(relics));
    return relics;
  },

  // Clear all
  clearAll() {
    localStorage.removeItem(this.STORAGE_KEY);
    return [];
  },

  // Get count
  count() {
    return this.getAll().length;
  },

  // Get stats
  getStats() {
    const relics = this.getAll();
    const colors = { Red: 0, Green: 0, Blue: 0, Yellow: 0 };
    let dnCount = 0;
    relics.forEach(r => {
      if (colors[r.color] !== undefined) colors[r.color]++;
      if (r.dn) dnCount++;
    });
    return {
      total: relics.length,
      colors,
      deepNight: dnCount,
      normal: relics.length - dnCount,
    };
  },

  // Import relics from JSON (merge)
  import(jsonArray) {
    const existing = this.getAll();
    const existingIds = new Set(existing.map(r => r.id));
    let added = 0;
    jsonArray.forEach(r => {
      if (!existingIds.has(r.id)) {
        existing.push(r);
        added++;
      }
    });
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existing));
    return added;
  },
};
