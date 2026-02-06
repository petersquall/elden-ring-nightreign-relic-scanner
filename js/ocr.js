// ==================== OCR MODULE ====================
const OCR = {
  worker: null,
  loading: false,

  async init() {
    if (this.worker) return;
    if (this.loading) return;
    this.loading = true;
    try {
      this.worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
    } finally {
      this.loading = false;
    }
  },

  async recognize(canvas, psm = 6) {
    if (!this.worker) await this.init();
    await this.worker.setParameters({ tessedit_pageseg_mode: psm });
    const { data } = await this.worker.recognize(canvas);
    return {
      text: data.text,
      confidence: data.confidence,
    };
  },

  isReady() {
    return !!this.worker;
  },
};
