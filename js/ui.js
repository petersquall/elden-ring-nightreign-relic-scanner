// ==================== UI HELPERS ====================
const UI = {
  // Screen management
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + id);
    if (screen) screen.classList.add('active');
  },

  // Toast notifications
  toast(message, type = 'info', duration = 2500) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  },

  // Settings slider bindings
  bindSliders() {
    ['contrast', 'threshold', 'blur', 'scale', 'fuseThreshold', 'scanInterval'].forEach(id => {
      const el = document.getElementById(id);
      const val = document.getElementById(id + 'Val');
      if (el && val) {
        el.addEventListener('input', () => {
          val.textContent = el.value;
          UI.saveSettings();
        });
      }
    });
    const psm = document.getElementById('psm');
    if (psm) {
      psm.addEventListener('change', () => {
        document.getElementById('psmVal').textContent = psm.value;
        UI.saveSettings();
      });
    }
    const inv = document.getElementById('invertCheck');
    if (inv) inv.addEventListener('change', () => UI.saveSettings());
  },

  // Persist settings
  saveSettings() {
    const settings = {
      contrast: document.getElementById('contrast')?.value,
      threshold: document.getElementById('threshold')?.value,
      blur: document.getElementById('blur')?.value,
      scale: document.getElementById('scale')?.value,
      fuseThreshold: document.getElementById('fuseThreshold')?.value,
      scanInterval: document.getElementById('scanInterval')?.value,
      psm: document.getElementById('psm')?.value,
      invert: document.getElementById('invertCheck')?.checked,
    };
    localStorage.setItem('relic-scanner-settings', JSON.stringify(settings));
  },

  loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('relic-scanner-settings'));
      if (!saved) return;
      Object.entries(saved).forEach(([key, val]) => {
        const el = document.getElementById(key === 'invert' ? 'invertCheck' : key);
        if (!el) return;
        if (key === 'invert') {
          el.checked = val;
        } else {
          el.value = val;
          const valEl = document.getElementById(key + 'Val');
          if (valEl) valEl.textContent = val;
        }
      });
    } catch (e) { /* ignore */ }
  },

  // Get current preprocessing settings
  getSettings() {
    return {
      contrast: parseFloat(document.getElementById('contrast')?.value || 1.4),
      threshold: parseFloat(document.getElementById('threshold')?.value || 0.5),
      blur: parseFloat(document.getElementById('blur')?.value || 0.8),
      scale: parseFloat(document.getElementById('scale')?.value || 2),
      fuseThreshold: parseFloat(document.getElementById('fuseThreshold')?.value || 0.35),
      scanInterval: parseFloat(document.getElementById('scanInterval')?.value || 3),
      psm: parseInt(document.getElementById('psm')?.value || 6),
      invert: document.getElementById('invertCheck')?.checked || false,
    };
  },
};
