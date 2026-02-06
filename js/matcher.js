// ==================== MATCHER MODULE ====================
const Matcher = {
  fuse: null,
  fuseRelicNames: null,
  normalizedDB: null,

  init(threshold = 0.35) {
    // Build normalized DB for better matching
    if (!this.normalizedDB) {
      this.normalizedDB = EFFECTS_DB.map(e => ({
        ...e,
        normalized: this.normalizeName(e.name),
      }));
    }

    this.fuse = new Fuse(this.normalizedDB, {
      keys: ['name', 'normalized'],
      threshold: threshold,
      distance: 300,
      includeScore: true,
      ignoreLocation: true,
      // Weight normalized name higher for OCR matching
      fieldNormWeight: 1,
    });

    // Build Fuse index for unique relic names
    if (typeof RELICS_NAME_DB !== 'undefined' && !this.fuseRelicNames) {
      this.fuseRelicNames = new Fuse(RELICS_NAME_DB, {
        keys: ['name'],
        threshold: 0.35,
        distance: 100,
        includeScore: true,
        ignoreLocation: true,
      });
    }

    this._threshold = threshold;
  },

  // Normalize effect name for better fuzzy matching
  normalizeName(name) {
    return name
      .replace(/\[.*?\]\s*/g, '')     // Remove [Class] prefixes like [Wylder], [Guardian]
      .replace(/['']/g, "'")          // Normalize quotes
      .replace(/[+]/g, ' plus ')      // + to text
      .replace(/\d+/g, m => ` ${m} `) // Space around numbers
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  },

  // Aggressive OCR text cleaning with common Tesseract mistakes
  cleanLine(line) {
    return line
      // Strip leading icon artifacts (1-3 junk chars before the actual effect text)
      .replace(/^[^a-zA-Z]{1,4}/, '')
      // Common Tesseract character confusions
      .replace(/[|lI]{2,}/g, m => 'Il'.slice(0, m.length))  // Multiple |/l/I
      .replace(/[|]/g, 'I')
      .replace(/0(?=[a-zA-Z])/g, 'O')       // 0 before letter → O
      .replace(/(?<=[a-zA-Z])0/g, 'O')       // 0 after letter → O
      .replace(/1(?=[a-zA-Z])/g, 'l')        // 1 before letter → l
      .replace(/(?<=[a-z])1/g, 'l')           // 1 after lowercase → l
      .replace(/rn/g, 'rn')                   // keep rn (common false positive fix disabled)
      .replace(/\bI-IP\b/gi, 'HP')           // I-IP → HP
      .replace(/\bI-P\b/gi, 'HP')            // I-P → HP
      .replace(/\bFP\b/gi, 'FP')             // Keep FP
      .replace(/\bI{2,}P\b/gi, 'HP')         // IIP → HP
      .replace(/\bI-{1,2}P\b/gi, 'HP')
      .replace(/\b[oO0]wn\b/g, 'own')
      .replace(/\batt ack\b/gi, 'attack')     // Space in middle of words
      .replace(/\bdam age\b/gi, 'damage')
      .replace(/\bres tores?\b/gi, 'restore')
      .replace(/\bincreas\w*\b/gi, m => m)    // Keep increase variants
      .replace(/[{}[\]]/g, '')                 // Remove brackets
      .replace(/[^\x20-\x7E]/g, '')           // Remove non-ASCII
      .replace(/\s+/g, ' ')
      .trim();
  },

  // Match OCR text to effects
  matchEffects(text, threshold) {
    if (!this.fuse || this._threshold !== threshold) {
      this.init(threshold);
    }

    const rawLines = text.split('\n')
      .map(l => this.cleanLine(l))
      .filter(l => l.length > 4);

    // Also try joining consecutive short lines (OCR sometimes splits one effect across lines)
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
      lines.push(rawLines[i]);
      // If current line is short and next exists, try joining
      if (rawLines[i].length < 25 && i + 1 < rawLines.length) {
        lines.push(rawLines[i] + ' ' + rawLines[i + 1]);
      }
    }

    const bestMatches = new Map();

    lines.forEach((line, lineIdx) => {
      const results = this.fuse.search(line);
      if (!results.length) return;

      const best = results[0];
      const score = 1 - best.score;
      const id = best.item.id;

      // Only accept if score is reasonable
      if (score < 0.35) return;

      if (!bestMatches.has(id) || score > bestMatches.get(id).score) {
        bestMatches.set(id, {
          id: best.item.id,
          name: best.item.name,
          score: score,
          ocrLine: line,
          lineIdx: lineIdx,
        });
      }
    });

    // Sort by OCR line position (top to bottom as seen on screen)
    return [...bestMatches.values()].sort((a, b) => a.lineIdx - b.lineIdx);
  },

  // ==================== COLOR DETECTION ====================
  detectColor(imageData) {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;

    const samples = [];
    const regions = [
      { x1: 0, y1: 0, x2: Math.floor(w * 0.15), y2: Math.floor(h * 0.15) },
      { x1: Math.floor(w * 0.85), y1: 0, x2: w, y2: Math.floor(h * 0.15) },
      { x1: 0, y1: Math.floor(h * 0.85), x2: Math.floor(w * 0.15), y2: h },
      { x1: 0, y1: Math.floor(h * 0.3), x2: Math.floor(w * 0.08), y2: Math.floor(h * 0.7) },
      { x1: Math.floor(w * 0.92), y1: Math.floor(h * 0.3), x2: w, y2: Math.floor(h * 0.7) },
    ];

    regions.forEach(({ x1, y1, x2, y2 }) => {
      for (let y = y1; y < y2; y += 4) {
        for (let x = x1; x < x2; x += 4) {
          const idx = (y * w + x) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          const brightness = (r + g + b) / 3;
          if (brightness < 30 || brightness > 230) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          if (max - min < 25) continue;
          samples.push({ r, g, b });
        }
      }
    });

    if (samples.length < 10) return null;

    let hueSinSum = 0, hueCosSum = 0;
    samples.forEach(({ r, g, b }) => {
      const hue = this.rgbToHue(r, g, b);
      hueSinSum += Math.sin(hue * Math.PI / 180);
      hueCosSum += Math.cos(hue * Math.PI / 180);
    });

    const avgHue = ((Math.atan2(hueSinSum / samples.length, hueCosSum / samples.length) * 180 / Math.PI) + 360) % 360;

    if (avgHue >= 330 || avgHue < 30) return 'Red';
    if (avgHue >= 30 && avgHue < 70) return 'Yellow';
    if (avgHue >= 70 && avgHue < 170) return 'Green';
    if (avgHue >= 170 && avgHue < 330) return 'Blue';
    return null;
  },

  rgbToHue(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return 0;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    return (h + 360) % 360;
  },

  // ==================== TEXT-BASED DETECTION ====================
  // Detect color, DN, quality, and unique relic name from OCR text
  detectFromText(text, matchedEffects) {
    let color = null;
    let isDeepNight = null;
    let quality = null;
    let relicName = null;

    // Try to match unique relic name from OCR text
    if (this.fuseRelicNames) {
      const lines = text.split('\n').map(l => this.cleanLine(l)).filter(l => l.length > 3);
      // Check first few lines (relic name is at the top of the screen)
      const topLines = lines.slice(0, 5);
      let bestRelicMatch = null;
      let bestRelicScore = 0;

      for (const line of topLines) {
        const results = this.fuseRelicNames.search(line);
        if (results.length > 0) {
          const score = 1 - results[0].score;
          if (score > 0.55 && score > bestRelicScore) {
            bestRelicMatch = results[0].item;
            bestRelicScore = score;
          }
        }
      }

      if (bestRelicMatch) {
        relicName = bestRelicMatch.name;
        color = bestRelicMatch.color;
        isDeepNight = bestRelicMatch.dn;
      }
    }

    // Color from scene name keywords (if not already found via unique name)
    if (!color) {
      if (/burning/i.test(text))   color = 'Red';
      if (/tranquil/i.test(text))  color = 'Green';
      if (/drizzly/i.test(text))   color = 'Blue';
      if (/luminous/i.test(text))  color = 'Yellow';
    }

    // DN from "Deep" anywhere in the relic name
    if (isDeepNight == null && /\bdeep\b/i.test(text)) {
      isDeepNight = true;
    }

    // Quality from relic name (most reliable, not based on effect count)
    if (/\bgrand\b/i.test(text))     quality = 'Grand';
    if (/\bpolished\b/i.test(text))  quality = 'Polished';
    if (/\bdelicate\b/i.test(text))  quality = 'Delicate';

    return { color, isDeepNight, quality, relicName };
  },

  colorToScene(color) {
    const map = { Red: 'Burning Scene', Green: 'Tranquil Scene', Blue: 'Drizzly Scene', Yellow: 'Luminous Scene' };
    return map[color] || '--';
  },

  // Generate full relic name from detected properties
  // detectedQuality: from OCR text (most reliable), effectCount: fallback
  getRelicName(color, dn, effectCount, detectedQuality) {
    const scene = this.colorToScene(color);
    if (scene === '--') return null;
    let quality = detectedQuality;
    if (!quality) {
      // Fallback: guess quality from effect count
      if (dn) {
        if (effectCount <= 2) quality = 'Delicate';
        else if (effectCount <= 4) quality = 'Polished';
        else quality = 'Grand';
      } else {
        if (effectCount <= 1) quality = 'Delicate';
        else if (effectCount <= 2) quality = 'Polished';
        else quality = 'Grand';
      }
    }
    return `${dn ? 'Deep ' : ''}${quality} ${scene}`;
  },
};
