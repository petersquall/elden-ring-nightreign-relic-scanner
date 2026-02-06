// ==================== IMAGE PREPROCESSING ====================
const Preprocessor = {
  process(imageData, settings) {
    const { contrast, threshold, blur: blurRadius, scale, invert } = settings;
    const w = imageData.width, h = imageData.height;
    const src = imageData.data;

    // Grayscale + Contrast
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      let v = (0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2]) / 255;
      v = Math.max(0, Math.min(1, ((v - 0.5) * contrast) + 0.5));
      if (invert) v = 1 - v;
      gray[i] = v;
    }

    // Box blur
    let blurred = gray;
    if (blurRadius > 0) {
      blurred = new Float32Array(w * h);
      const rad = Math.ceil(blurRadius);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = 0, cnt = 0;
          for (let dy = -rad; dy <= rad; dy++) {
            for (let dx = -rad; dx <= rad; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                sum += gray[ny * w + nx];
                cnt++;
              }
            }
          }
          blurred[y * w + x] = sum / cnt;
        }
      }
    }

    // Binarize
    const binary = new Uint8ClampedArray(w * h);
    for (let i = 0; i < w * h; i++) {
      binary[i] = blurred[i] > threshold ? 255 : 0;
    }

    // Scale up
    const nw = Math.round(w * scale), nh = Math.round(h * scale);
    const output = new ImageData(nw, nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const v = binary[Math.floor(y / scale) * w + Math.floor(x / scale)];
        const idx = (y * nw + x) * 4;
        output.data[idx] = output.data[idx + 1] = output.data[idx + 2] = v;
        output.data[idx + 3] = 255;
      }
    }

    return output;
  }
};
