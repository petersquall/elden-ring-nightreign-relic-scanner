// ==================== MAIN APP ====================
const App = {
  isScanning: false,
  scanTimer: null,
  isProcessing: false,
  currentEffects: [],    // matched effects for current scan
  currentColor: null,    // detected color
  manualColor: null,     // user-overridden color
  detectedQuality: null, // quality from OCR text (Grand/Polished/Delicate)
  detectedRelicName: null, // unique relic name from OCR (e.g. "Glass Necklace")

  async init() {
    // Load saved settings
    UI.loadSettings();
    UI.bindSliders();

    // Pre-load Tesseract
    this.updateScanStatus('loading', 'Loading OCR...');
    try {
      await OCR.init();
      this.updateScanStatus('paused', 'Ready');
    } catch (err) {
      this.updateScanStatus('paused', 'OCR load failed');
      UI.toast('Failed to load Tesseract', 'error');
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Bind all events
    this.bindHomeEvents();
    this.bindScannerEvents();
    this.bindExportEvents();

    // Show home
    this.showHome();
  },

  // ==================== NAVIGATION ====================
  showHome() {
    this.stopScanning();
    Camera.stop();
    UI.showScreen('home');
    this.renderRelicList();
  },

  async showScanner() {
    UI.showScreen('scanner');
    await Camera.init(document.getElementById('video'), document.getElementById('scannerCamera'));
    const ok = await Camera.start();
    if (!ok) {
      UI.toast('Camera access denied', 'error');
      this.showHome();
      return;
    }
    this.updateScanStatus('paused', 'Ready');
    this.resetScanResults();
  },

  showExport() {
    UI.showScreen('export');
    this.renderExport();
  },

  // ==================== HOME SCREEN ====================
  bindHomeEvents() {
    document.getElementById('btnScan').addEventListener('click', () => this.showScanner());
    document.getElementById('btnExport').addEventListener('click', () => this.showExport());
  },

  renderRelicList() {
    const relics = RelicManager.getAll();
    const list = document.getElementById('relicList');
    const empty = document.getElementById('emptyState');
    const count = document.getElementById('relicCount');

    count.textContent = `${relics.length} relic${relics.length !== 1 ? 's' : ''}`;

    if (relics.length === 0) {
      list.innerHTML = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';

    // Build effect name lookup for display
    const effectMap = new Map();
    EFFECTS_DB.forEach(e => effectMap.set(e.id, e.name));

    list.innerHTML = relics.map(r => {
      const effectNames = r.effects.map(id => effectMap.get(id) || `#${id}`).join(', ');
      const relicName = r.name || Matcher.getRelicName(r.color, r.dn, r.effects.length) || `${r.color} Relic`;
      return `
        <div class="relic-card" data-id="${r.id}">
          <div class="relic-color-bar ${r.color}"></div>
          <div class="relic-info">
            <div class="relic-name">${relicName}</div>
            <div class="relic-effects-summary">${effectNames}</div>
            <div class="relic-meta">
              ${r.dn ? '<span class="relic-badge badge-dn">DN</span>' : ''}
              <span style="font-size:10px;color:#555">${r.effects.length} effects</span>
            </div>
          </div>
          <button class="relic-delete" data-delete="${r.id}">&times;</button>
        </div>
      `;
    }).join('');

    // Delete buttons
    list.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.delete;
        RelicManager.delete(id);
        this.renderRelicList();
        UI.toast('Relic deleted', 'info');
      });
    });
  },

  // ==================== SCANNER SCREEN ====================
  bindScannerEvents() {
    document.getElementById('btnBackToHome').addEventListener('click', () => this.showHome());
    document.getElementById('btnFlipCamera').addEventListener('click', () => Camera.flip());
    document.getElementById('btnToggleScan').addEventListener('click', () => {
      if (this.isScanning) this.stopScanning();
      else this.startScanning();
    });
    document.getElementById('btnSaveRelic').addEventListener('click', () => this.saveCurrentRelic());

    // Settings
    document.getElementById('btnSettings').addEventListener('click', () => {
      document.getElementById('settingsPanel').classList.toggle('open');
    });
    document.getElementById('btnCloseSettings').addEventListener('click', () => {
      document.getElementById('settingsPanel').classList.remove('open');
    });

    // Color buttons
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.manualColor = btn.dataset.color;
        this.updateColorDisplay(this.manualColor);
        this.updateRelicName();
      });
    });

    // DN toggle
    document.getElementById('dnToggle').addEventListener('change', () => {
      this.updateRelicName();
    });
  },

  resetScanResults() {
    this.currentEffects = [];
    this.currentColor = null;
    this.manualColor = null;
    document.getElementById('effectList').innerHTML = '<div class="no-effects">Point camera at relic effects</div>';
    document.getElementById('btnSaveRelic').disabled = true;
    document.getElementById('dnToggle').checked = false;
    document.getElementById('relicNameDisplay').textContent = '--';
    this.detectedQuality = null;
    this.detectedRelicName = null;
    this.updateColorDisplay(null);
  },

  startScanning() {
    this.isScanning = true;
    const btn = document.getElementById('btnToggleScan');
    btn.textContent = 'Stop';
    btn.className = 'btn-toggle-scan scanning';
    this.updateScanStatus('scanning', 'Scanning');

    this.scanOnce();
    const interval = UI.getSettings().scanInterval;
    this.scanTimer = setInterval(() => {
      if (!this.isProcessing) this.scanOnce();
    }, interval * 1000);
  },

  stopScanning() {
    this.isScanning = false;
    if (this.scanTimer) clearInterval(this.scanTimer);
    this.scanTimer = null;
    const btn = document.getElementById('btnToggleScan');
    btn.textContent = 'Start Scan';
    btn.className = 'btn-toggle-scan';
    this.updateScanStatus('paused', 'Paused');
  },

  async scanOnce() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const info = document.getElementById('scannerInfo');
    info.textContent = 'Processing...';

    const t0 = performance.now();

    try {
      const settings = UI.getSettings();

      // Grab cropped frame for OCR
      const croppedFrame = Camera.grabCroppedFrame();
      if (!croppedFrame) { this.isProcessing = false; return; }

      // Grab full frame for color detection
      const fullFrame = Camera.grabFullFrame();

      // Preprocess
      const processed = Preprocessor.process(croppedFrame, settings);
      const pCanvas = document.getElementById('processedCanvas');
      pCanvas.width = processed.width;
      pCanvas.height = processed.height;
      pCanvas.getContext('2d').putImageData(processed, 0, 0);

      // OCR
      const result = await OCR.recognize(pCanvas, settings.psm);
      const ms = Math.round(performance.now() - t0);
      info.textContent = `${Math.round(result.confidence)}% conf | ${ms}ms`;

      // Match effects
      const effects = Matcher.matchEffects(result.text, settings.fuseThreshold);

      // Filter: only keep matches with decent score
      const goodEffects = effects.filter(e => e.score > 0.45);

      if (goodEffects.length > 0) {
        this.currentEffects = goodEffects;
        this.renderEffectList(goodEffects);
        document.getElementById('btnSaveRelic').disabled = false;
      }

      // Detect color + DN from OCR text and effect names (most reliable)
      const textDetection = Matcher.detectFromText(result.text, goodEffects);

      // Store detected quality and unique relic name from OCR text
      if (textDetection.quality) {
        this.detectedQuality = textDetection.quality;
      }
      if (textDetection.relicName) {
        this.detectedRelicName = textDetection.relicName;
      }

      // Auto-detect DN: from text, from effect names, or from effect count
      if (textDetection.isDeepNight != null) {
        document.getElementById('dnToggle').checked = textDetection.isDeepNight;
      } else {
        document.getElementById('dnToggle').checked = goodEffects.length >= 5;
      }

      // Color: prefer text detection (Burning/Tranquil/etc), fallback to pixel analysis
      if (!this.manualColor) {
        if (textDetection.color) {
          this.currentColor = textDetection.color;
          this.updateColorDisplay(textDetection.color);
        } else if (fullFrame) {
          const pixelColor = Matcher.detectColor(fullFrame);
          if (pixelColor) {
            this.currentColor = pixelColor;
            this.updateColorDisplay(pixelColor);
          }
        }
      }

      // Update relic name display
      this.updateRelicName();

    } catch (err) {
      info.textContent = 'Error: ' + err.message;
      console.error('Scan error:', err);
    }

    this.isProcessing = false;
  },

  renderEffectList(effects) {
    const list = document.getElementById('effectList');
    list.innerHTML = effects.map((e, i) => {
      const cls = e.score > 0.75 ? 'score-good' : e.score > 0.5 ? 'score-ok' : 'score-bad';
      return `
        <div class="effect-item" data-idx="${i}">
          <span class="effect-name">${e.name}</span>
          <span class="effect-id">${e.id}</span>
          <span class="effect-score ${cls}">${Math.round(e.score * 100)}%</span>
          <button class="effect-remove" data-remove="${i}">&times;</button>
        </div>
      `;
    }).join('');

    // Remove buttons
    list.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.remove);
        this.currentEffects.splice(idx, 1);
        this.renderEffectList(this.currentEffects);
        this.updateRelicName();
        if (this.currentEffects.length === 0) {
          document.getElementById('btnSaveRelic').disabled = true;
        }
      });
    });
  },

  updateColorDisplay(color) {
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === color);
    });
  },

  updateRelicName() {
    // Prefer unique relic name (e.g. "Glass Necklace"), fallback to scene name
    if (this.detectedRelicName) {
      document.getElementById('relicNameDisplay').textContent = this.detectedRelicName;
      return;
    }
    const color = this.manualColor || this.currentColor;
    const dn = document.getElementById('dnToggle').checked;
    const count = this.currentEffects.length;
    const name = color ? Matcher.getRelicName(color, dn, count, this.detectedQuality) : '--';
    document.getElementById('relicNameDisplay').textContent = name || '--';
  },

  updateScanStatus(state, text) {
    const el = document.getElementById('scanStatus');
    el.textContent = text;
    el.className = 'scan-status ' + state;
  },

  saveCurrentRelic() {
    const color = this.manualColor || this.currentColor;
    if (!color) {
      UI.toast('Set a relic color first (tap the color dot)', 'error');
      return;
    }
    if (this.currentEffects.length === 0) {
      UI.toast('No effects detected', 'error');
      return;
    }

    const dn = document.getElementById('dnToggle').checked;
    const effectIds = this.currentEffects.map(e => e.id);
    const name = this.detectedRelicName || document.getElementById('relicNameDisplay').textContent;

    const relic = RelicManager.createRelic(color, effectIds, dn, name !== '--' ? name : null);
    RelicManager.save(relic);

    const count = RelicManager.count();
    UI.toast(`Relic saved! (${count} total)`, 'success');

    // Reset for next scan
    this.resetScanResults();

    // Keep scanning if it was running
    if (!this.isScanning) {
      this.startScanning();
    }
  },

  // ==================== EXPORT SCREEN ====================
  bindExportEvents() {
    document.getElementById('btnBackFromExport').addEventListener('click', () => this.showHome());
    document.getElementById('btnDownloadJSON').addEventListener('click', async () => {
      const relics = RelicManager.getAll();
      if (relics.length === 0) { UI.toast('No relics to export', 'error'); return; }
      const ok = await Exporter.downloadJSON(relics);
      if (ok !== false) UI.toast('JSON exported!', 'success');
    });
    document.getElementById('btnCopyJSON').addEventListener('click', async () => {
      const relics = RelicManager.getAll();
      if (relics.length === 0) { UI.toast('No relics to export', 'error'); return; }
      const ok = await Exporter.copyToClipboard(relics);
      UI.toast(ok ? 'Copied to clipboard!' : 'Copy failed', ok ? 'success' : 'error');
    });
    document.getElementById('btnClearAll').addEventListener('click', () => {
      if (confirm('Delete ALL relics? This cannot be undone.')) {
        RelicManager.clearAll();
        UI.toast('All relics cleared', 'info');
        this.showHome();
      }
    });
  },

  renderExport() {
    const relics = RelicManager.getAll();
    const stats = RelicManager.getStats();

    document.getElementById('exportSummary').innerHTML = `
      <div class="summary-card">
        <div class="num">${stats.total}</div>
        <div class="label">Total Relics</div>
      </div>
      <div class="summary-card">
        <div class="num">${stats.deepNight}</div>
        <div class="label">Deep Night</div>
      </div>
      <div class="summary-card">
        <div class="num" style="color:#e74c3c">${stats.colors.Red}</div>
        <div class="label">Red</div>
      </div>
      <div class="summary-card">
        <div class="num" style="color:#2ecc71">${stats.colors.Green}</div>
        <div class="label">Green</div>
      </div>
      <div class="summary-card">
        <div class="num" style="color:#3498db">${stats.colors.Blue}</div>
        <div class="label">Blue</div>
      </div>
      <div class="summary-card">
        <div class="num" style="color:#f1c40f">${stats.colors.Yellow}</div>
        <div class="label">Yellow</div>
      </div>
    `;

    const preview = document.getElementById('jsonPreview');
    if (relics.length > 0) {
      // Show first 3 relics in preview
      const previewData = relics.slice(0, 3);
      let json = Exporter.toJSON(previewData);
      if (relics.length > 3) {
        json = json.slice(0, -2) + ',\n  ...' + (relics.length - 3) + ' more\n]';
      }
      preview.textContent = json;
    } else {
      preview.textContent = '[]';
    }
  },
};

// ==================== START ====================
document.addEventListener('DOMContentLoaded', () => App.init());
