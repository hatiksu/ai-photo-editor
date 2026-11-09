// Обработка пикселей: тон, цвет, эффекты. Работает с ImageData без зависимостей.

export const SLIDERS = [
  { group: 'Свет' },
  { key: 'exposure', label: 'Экспозиция', min: -100, max: 100 },
  { key: 'brightness', label: 'Яркость', min: -100, max: 100 },
  { key: 'contrast', label: 'Контраст', min: -100, max: 100 },
  { key: 'highlights', label: 'Света', min: -100, max: 100 },
  { key: 'shadows', label: 'Тени', min: -100, max: 100 },
  { group: 'Цвет' },
  { key: 'temperature', label: 'Температура', min: -100, max: 100 },
  { key: 'tint', label: 'Оттенок', min: -100, max: 100 },
  { key: 'saturation', label: 'Насыщенность', min: -100, max: 100 },
  { key: 'vibrance', label: 'Сочность', min: -100, max: 100 },
  { group: 'Эффекты' },
  { key: 'sharpness', label: 'Резкость', min: 0, max: 100 },
  { key: 'vignette', label: 'Виньетка', min: 0, max: 100 },
  { key: 'grain', label: 'Зерно', min: 0, max: 100 },
  { key: 'fade', label: 'Выцветание', min: 0, max: 100 },
  { key: 'sepia', label: 'Сепия', min: 0, max: 100 },
  { key: 'grayscale', label: 'Ч/Б', min: 0, max: 100 },
];

export const ADJ_KEYS = SLIDERS.filter((s) => s.key).map((s) => s.key);
export const RANGES = Object.fromEntries(SLIDERS.filter((s) => s.key).map((s) => [s.key, [s.min, s.max]]));

export function defaultAdjustments() {
  return Object.fromEntries(ADJ_KEYS.map((k) => [k, 0]));
}

export function clampAdjustments(adj) {
  const out = defaultAdjustments();
  for (const k of ADJ_KEYS) {
    const v = Math.round(Number(adj?.[k]) || 0);
    const [lo, hi] = RANGES[k];
    out[k] = Math.min(hi, Math.max(lo, v));
  }
  return out;
}

export const PRESETS = [
  { name: 'Оригинал', adj: {} },
  { name: 'Яркий', adj: { contrast: 20, saturation: 25, vibrance: 30, sharpness: 20 } },
  { name: 'Тёплый', adj: { temperature: 40, tint: 8, vibrance: 15, shadows: 10 } },
  { name: 'Холодный', adj: { temperature: -40, contrast: 10, highlights: -10 } },
  { name: 'Драма', adj: { contrast: 45, highlights: -40, shadows: 25, saturation: -15, vignette: 50, sharpness: 30 } },
  { name: 'Винтаж', adj: { temperature: 25, fade: 45, sepia: 30, contrast: -10, vignette: 35, grain: 25 } },
  { name: 'Плёнка', adj: { fade: 30, contrast: 15, temperature: 10, tint: -8, grain: 35, saturation: -10 } },
  { name: 'Мягкий', adj: { contrast: -20, highlights: -20, shadows: 30, fade: 15, saturation: -10 } },
  { name: 'Ч/Б', adj: { grayscale: 100, contrast: 25, sharpness: 15 } },
  { name: 'Нуар', adj: { grayscale: 100, contrast: 60, shadows: -25, vignette: 60, grain: 20 } },
  { name: 'Закат', adj: { temperature: 55, tint: 15, saturation: 15, highlights: -15, vignette: 25 } },
  { name: 'Мята', adj: { temperature: -15, tint: -20, fade: 20, vibrance: 10, brightness: 8 } },
].map((p) => ({ ...p, adj: { ...defaultAdjustments(), ...p.adj } }));

function sharpen(src, w, h, amount) {
  // Лапласиан 3x3: [0,-a,0; -a,1+4a,-a; 0,-a,0]
  const a = (amount / 100) * 0.8;
  const out = new Uint8ClampedArray(src.length);
  const stride = w * 4;
  for (let y = 0; y < h; y++) {
    const yu = y > 0 ? -stride : 0;
    const yd = y < h - 1 ? stride : 0;
    for (let x = 0; x < w; x++) {
      const i = y * stride + x * 4;
      const xl = x > 0 ? -4 : 0;
      const xr = x < w - 1 ? 4 : 0;
      for (let c = 0; c < 3; c++) {
        const p = i + c;
        out[p] = src[p] * (1 + 4 * a) - a * (src[p + yu] + src[p + yd] + src[p + xl] + src[p + xr]);
      }
      out[i + 3] = src[i + 3];
    }
  }
  return out;
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Применяет настройки к ImageData и возвращает новый ImageData. */
export function applyAdjustments(imageData, adj) {
  const { width: w, height: h } = imageData;
  let src = imageData.data;
  if (adj.sharpness > 0) src = sharpen(src, w, h, adj.sharpness);
  const out = new ImageData(w, h);
  const d = out.data;

  const ev = Math.pow(2, adj.exposure / 50);
  const bright = (adj.brightness / 100) * 0.35;
  const cK = adj.contrast >= 0 ? 1 + (adj.contrast / 100) * 1.4 : 1 + adj.contrast / 110;
  const temp = (adj.temperature / 100) * 0.14;
  const tint = (adj.tint / 100) * 0.1;
  const sh = (adj.shadows / 100) * 0.3;
  const hi = (adj.highlights / 100) * 0.3;
  const sat = 1 + adj.saturation / 100;
  const vib = adj.vibrance / 100;
  const gray = adj.grayscale / 100;
  const sep = adj.sepia / 100;
  const fade = adj.fade / 100;
  const vig = (adj.vignette / 100) * 0.85;
  const grain = (adj.grain / 100) * 0.18;

  const cx = w / 2;
  const cy = h / 2;
  const maxD = Math.sqrt(cx * cx + cy * cy);
  let seed = 1234567;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = src[i] / 255;
      let g = src[i + 1] / 255;
      let b = src[i + 2] / 255;

      // Экспозиция и яркость
      r = r * ev + bright;
      g = g * ev + bright;
      b = b * ev + bright;

      // Баланс белого
      r += temp + tint * 0.5;
      g -= tint;
      b += -temp + tint * 0.5;

      // Света / тени
      if (sh !== 0 || hi !== 0) {
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const delta = sh * (1 - smooth(0, 0.55, L)) + hi * smooth(0.45, 1, L);
        r += delta; g += delta; b += delta;
      }

      // Контраст
      r = (r - 0.5) * cK + 0.5;
      g = (g - 0.5) * cK + 0.5;
      b = (b - 0.5) * cK + 0.5;

      // Насыщенность и сочность
      if (sat !== 1 || vib !== 0) {
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        const s = mx - mn;
        const f = sat + vib * (1 - Math.min(1, s * 1.5));
        r = L + (r - L) * f;
        g = L + (g - L) * f;
        b = L + (b - L) * f;
      }

      // Сепия
      if (sep > 0) {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b;
        const sg = 0.349 * r + 0.686 * g + 0.168 * b;
        const sb = 0.272 * r + 0.534 * g + 0.131 * b;
        r += (sr - r) * sep; g += (sg - g) * sep; b += (sb - b) * sep;
      }

      // Ч/Б
      if (gray > 0) {
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r += (L - r) * gray; g += (L - g) * gray; b += (L - b) * gray;
      }

      // Выцветание (подъём чёрного)
      if (fade > 0) {
        r = r * (1 - fade * 0.25) + fade * 0.1;
        g = g * (1 - fade * 0.25) + fade * 0.1;
        b = b * (1 - fade * 0.25) + fade * 0.1;
      }

      // Виньетка
      if (vig > 0) {
        const dx = x - cx;
        const dy = y - cy;
        const k = 1 - vig * smooth(0.35, 1, Math.sqrt(dx * dx + dy * dy) / maxD);
        r *= k; g *= k; b *= k;
      }

      // Зерно (детерминированное, чтобы не мерцало)
      if (grain > 0) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const n = (seed / 0x7fffffff - 0.5) * grain;
        r += n; g += n; b += n;
      }

      d[i] = r * 255;
      d[i + 1] = g * 255;
      d[i + 2] = b * 255;
      d[i + 3] = src[i + 3];
    }
  }
  return out;
}

/** Локальное «ИИ»-авто-улучшение: подбирает значения ползунков по статистике изображения. */
export function autoEnhance(imageData) {
  const { data } = imageData;
  const hist = new Uint32Array(256);
  let sr = 0, sg = 0, sb = 0, ss = 0, n = 0;
  const step = Math.max(1, Math.floor(data.length / 4 / 200000)) * 4;
  for (let i = 0; i < data.length; i += step) {
    if (data[i + 3] < 16) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    sr += r; sg += g; sb += b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    ss += mx ? (mx - mn) / mx : 0;
    hist[Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)]++;
    n++;
  }
  if (!n) return defaultAdjustments();
  const pct = (p) => {
    let acc = 0;
    const target = n * p;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) return v / 255; }
    return 1;
  };
  const lo = pct(0.01), mid = pct(0.5), hi = pct(0.99);
  const mR = sr / n / 255, mG = sg / n / 255, mB = sb / n / 255;
  const meanSat = ss / n;
  const shadowsFrac = hist.slice(0, 40).reduce((a, b) => a + b, 0) / n;
  const clipFrac = hist.slice(245).reduce((a, b) => a + b, 0) / n;

  const adj = defaultAdjustments();
  adj.exposure = Math.log2(0.46 / Math.max(0.05, mid)) * 40;
  const spread = hi - lo;
  adj.contrast = spread < 0.9 ? (0.9 - spread) * 90 : 0;
  adj.shadows = shadowsFrac > 0.15 ? Math.min(45, shadowsFrac * 120) : 0;
  adj.highlights = clipFrac > 0.02 ? -Math.min(50, clipFrac * 600) : 0;
  // Серый мир: выравниваем каналы
  adj.temperature = ((mB - mR) / 0.14) * 45;
  adj.tint = ((mR + mB) / 2 - mG) / 0.1 * -45;
  adj.vibrance = meanSat < 0.3 ? (0.3 - meanSat) * 120 : 5;
  adj.sharpness = 15;
  return clampAdjustments({
    ...adj,
    exposure: Math.max(-50, Math.min(50, adj.exposure)),
    temperature: Math.max(-35, Math.min(35, adj.temperature)),
    tint: Math.max(-25, Math.min(25, adj.tint)),
    contrast: Math.min(35, adj.contrast),
    vibrance: Math.min(35, adj.vibrance),
  });
}
