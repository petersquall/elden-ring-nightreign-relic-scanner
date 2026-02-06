// ==================== EXPORTER ====================
const Exporter = {
  // Generate relics.pro compatible JSON
  toJSON(relics) {
    // Only include the fields relics.pro expects
    const clean = relics.map(r => ({
      id: r.id,
      itemId: r.itemId || -1000000,
      color: r.color,
      dn: r.dn || false,
      effects: r.effects || [],
    }));
    return JSON.stringify(clean, null, 2);
  },

  // Download as .json file (iOS-compatible via Share API)
  async downloadJSON(relics) {
    const json = this.toJSON(relics);
    const date = new Date().toISOString().split('T')[0];
    const filename = `relics-export-${date}.json`;

    // Try native Share API first (works on iOS Safari)
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([json], filename, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Relic Export' });
          return true;
        }
      } catch (e) {
        if (e.name === 'AbortError') return false; // User cancelled
      }
    }

    // Fallback: open JSON in new tab (user can long-press to save on iOS)
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  },

  // Copy to clipboard
  async copyToClipboard(relics) {
    const json = this.toJSON(relics);
    try {
      await navigator.clipboard.writeText(json);
      return true;
    } catch (e) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = json;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  },
};
