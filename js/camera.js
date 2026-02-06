// ==================== CAMERA MODULE ====================
const Camera = {
  video: null,
  stream: null,
  facingMode: 'environment',
  containerEl: null,

  // Crop box state (percentages)
  crop: { x: 5, y: 8, w: 90, h: 84 },

  async init(videoEl, containerEl) {
    this.video = videoEl;
    this.containerEl = containerEl;
    this.loadCrop();
    this.setupCropDrag();
    this.updateCropVisuals();
    window.addEventListener('resize', () => this.updateCropVisuals());
  },

  async start() {
    try {
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      this.video.srcObject = this.stream;
      this.video.onloadedmetadata = () => this.updateCropVisuals();
      await this.video.play();
      return true;
    } catch (err) {
      console.error('Camera error:', err);
      return false;
    }
  },

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  },

  flip() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    return this.start();
  },

  // Grab the cropped region from the video frame
  grabCroppedFrame() {
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!vw || !vh) return null;

    const canvas = document.getElementById('captureCanvas');
    const secW = this.containerEl.offsetWidth;
    const secH = this.containerEl.offsetHeight;
    const videoAspect = vw / vh;
    const secAspect = secW / secH;

    let visX = 0, visY = 0, visW = vw, visH = vh;
    if (videoAspect > secAspect) {
      visW = vh * secAspect;
      visX = (vw - visW) / 2;
    } else {
      visH = vw / secAspect;
      visY = (vh - visH) / 2;
    }

    const cx = visX + (this.crop.x / 100) * visW;
    const cy = visY + (this.crop.y / 100) * visH;
    const cw = (this.crop.w / 100) * visW;
    const ch = (this.crop.h / 100) * visH;

    const sx = Math.max(0, Math.round(cx));
    const sy = Math.max(0, Math.round(cy));
    const sw = Math.min(Math.round(cw), vw - sx);
    const sh = Math.min(Math.round(ch), vh - sy);

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, sw, sh);
    return ctx.getImageData(0, 0, sw, sh);
  },

  // Grab the full frame (for color detection)
  grabFullFrame() {
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!vw || !vh) return null;

    const canvas = document.getElementById('captureCanvas');
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0);
    return ctx.getImageData(0, 0, vw, vh);
  },

  // ==================== CROP BOX VISUALS ====================
  updateCropVisuals() {
    const sec = this.containerEl;
    if (!sec) return;
    const sw = sec.offsetWidth;
    const sh = sec.offsetHeight;

    const px = this.crop.x / 100 * sw;
    const py = this.crop.y / 100 * sh;
    const pw = this.crop.w / 100 * sw;
    const ph = this.crop.h / 100 * sh;

    const cutout = document.getElementById('cropCutout');
    if (cutout) {
      cutout.setAttribute('x', px);
      cutout.setAttribute('y', py);
      cutout.setAttribute('width', pw);
      cutout.setAttribute('height', ph);
    }

    const border = document.getElementById('cropBorder');
    if (border) {
      border.style.left = px + 'px';
      border.style.top = py + 'px';
      border.style.width = pw + 'px';
      border.style.height = ph + 'px';
    }

    const handle = document.getElementById('cropResizeHandle');
    if (handle) {
      handle.style.left = (px + pw - 13) + 'px';
      handle.style.top = (py + ph - 13) + 'px';
    }

    this.saveCrop();
  },

  // ==================== CROP BOX DRAG ====================
  setupCropDrag() {
    const border = document.getElementById('cropBorder');
    const handle = document.getElementById('cropResizeHandle');
    if (!border || !handle) return;

    let mode = null;
    let startTouch = null;
    let startCrop = null;

    const onStart = (e, m) => {
      e.preventDefault();
      mode = m;
      const t = e.touches ? e.touches[0] : e;
      startTouch = { x: t.clientX, y: t.clientY };
      startCrop = { ...this.crop };
    };

    const onMove = (e) => {
      if (!mode || !startTouch) return;
      e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      const sec = this.containerEl;
      const dx = (t.clientX - startTouch.x) / sec.offsetWidth * 100;
      const dy = (t.clientY - startTouch.y) / sec.offsetHeight * 100;

      if (mode === 'move') {
        this.crop.x = Math.max(0, Math.min(100 - startCrop.w, startCrop.x + dx));
        this.crop.y = Math.max(0, Math.min(100 - startCrop.h, startCrop.y + dy));
      } else {
        this.crop.w = Math.max(20, Math.min(100 - this.crop.x, startCrop.w + dx));
        this.crop.h = Math.max(15, Math.min(100 - this.crop.y, startCrop.h + dy));
      }
      this.updateCropVisuals();
    };

    const onEnd = () => { mode = null; startTouch = null; };

    border.addEventListener('touchstart', e => onStart(e, 'move'));
    border.addEventListener('mousedown', e => onStart(e, 'move'));
    handle.addEventListener('touchstart', e => onStart(e, 'resize'));
    handle.addEventListener('mousedown', e => onStart(e, 'resize'));
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchend', onEnd);
    document.addEventListener('mouseup', onEnd);
  },

  saveCrop() {
    localStorage.setItem('relic-scanner-crop', JSON.stringify(this.crop));
  },

  loadCrop() {
    try {
      const saved = JSON.parse(localStorage.getItem('relic-scanner-crop'));
      if (saved) this.crop = saved;
    } catch (e) { /* ignore */ }
  },
};
