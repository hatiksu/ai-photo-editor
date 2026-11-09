import {
  SLIDERS, PRESETS, defaultAdjustments, applyAdjustments, autoEnhance,
} from './processing.js';

// ИИ-модуль грузится лениво: если CDN недоступен, остальной редактор продолжает работать.
let aiModule;
const loadAI = () => (aiModule ??= import('./ai.js'));

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const PREVIEW_MAX = 1600;
const HISTORY_MAX = 40;

const state = {
  original: null, // исходный холст
  base: null, // текущий холст (после обрезки/поворота/удаления фона)
  adj: defaultAdjustments(),
  preset: 'Оригинал',
  history: [],
  index: -1,
  previewSrc: null, // ImageData уменьшенной копии base
  cutout: null, // результат удаления фона (прозрачный)
  cutoutSource: null, // base до удаления фона
  fileName: 'photo',
  cropping: false,
  crop: { x: 0, y: 0, w: 1, h: 1 },
  aspect: 'free',
};

const view = $('#view');
const viewCtx = view.getContext('2d');

// ---------- Утилиты ----------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function scaledImageData(src, maxSide) {
  const s = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = makeCanvas(Math.max(1, Math.round(src.width * s)), Math.max(1, Math.round(src.height * s)));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height);
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 6000 : 3000);
}

function busy(on, text = 'Обработка…') {
  $('#busy').hidden = !on;
  $('#busyText').textContent = text;
}

const nextFrame = () => new Promise((r) => setTimeout(r, 30));

const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* недоступно */ } },
};

// ---------- Загрузка ----------

async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Это не изображение', true);
    return;
  }
  busy(true, 'Загрузка…');
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const c = makeCanvas(bitmap.width, bitmap.height);
    c.getContext('2d').drawImage(bitmap, 0, 0);
    state.fileName = file.name?.replace(/\.[^.]+$/, '') || 'photo';
    state.original = c;
    state.cutout = null;
    state.cutoutSource = null;
    state.history = [];
    state.index = -1;
    setBase(c);
    state.adj = defaultAdjustments();
    state.preset = 'Оригинал';
    commit();
    $('#dropzone').hidden = true;
    $('#canvasWrap').hidden = false;
    $('#bgOptions').hidden = true;
    $$('button[disabled], #autoBtn, #bgBtn, #aiBtn').forEach((b) => { b.disabled = false; });
    updateHistoryButtons();
  } catch (e) {
    console.error(e);
    toast('Не удалось открыть изображение', true);
  } finally {
    busy(false);
  }
}

function setBase(canvas) {
  state.base = canvas;
  state.previewSrc = scaledImageData(canvas, PREVIEW_MAX);
  view.width = state.previewSrc.width;
  view.height = state.previewSrc.height;
  $('#info').textContent = `${canvas.width} × ${canvas.height}`;
  buildPresetThumbs();
}

// ---------- Рендер ----------

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function render() {
  if (!state.previewSrc) return;
  viewCtx.putImageData(applyAdjustments(state.previewSrc, state.adj), 0, 0);
}

function showOriginal() {
  if (!state.original) return;
  const img = scaledImageData(state.original, PREVIEW_MAX);
  view.width = img.width;
  view.height = img.height;
  viewCtx.putImageData(img, 0, 0);
}

function restoreView() {
  view.width = state.previewSrc.width;
  view.height = state.previewSrc.height;
  render();
}

// ---------- История ----------

function commit() {
  state.history = state.history.slice(0, state.index + 1);
  state.history.push({ base: state.base, adj: { ...state.adj }, preset: state.preset });
  if (state.history.length > HISTORY_MAX) state.history.shift();
  state.index = state.history.length - 1;
  syncUI();
}

function restore(i) {
  const snap = state.history[i];
  if (!snap) return;
  state.index = i;
  if (snap.base !== state.base) setBase(snap.base);
  state.adj = { ...snap.adj };
  state.preset = snap.preset;
  syncUI();
}

const undo = () => state.index > 0 && restore(state.index - 1);
const redo = () => state.index < state.history.length - 1 && restore(state.index + 1);

function updateHistoryButtons() {
  $('#undoBtn').disabled = state.index <= 0;
  $('#redoBtn').disabled = state.index >= state.history.length - 1;
}

function syncUI() {
  for (const s of SLIDERS) {
    if (!s.key) continue;
    const input = $(`#sl-${s.key}`);
    input.value = state.adj[s.key];
    $(`#out-${s.key}`).textContent = state.adj[s.key];
  }
  $$('.preset').forEach((el) => el.classList.toggle('active', el.dataset.name === state.preset));
  updateHistoryButtons();
  scheduleRender();
}

// ---------- Ползунки ----------

function buildSliders() {
  const root = $('#sliders');
  for (const s of SLIDERS) {
    if (s.group) {
      const g = document.createElement('div');
      g.className = 'group-title';
      g.textContent = s.group;
      root.append(g);
      continue;
    }
    const el = document.createElement('div');
    el.className = 'slider';
    el.innerHTML = `
      <div class="slider-head">
        <label for="sl-${s.key}">${s.label}</label>
        <output id="out-${s.key}" title="Двойной клик — сброс">0</output>
      </div>
      <input type="range" id="sl-${s.key}" min="${s.min}" max="${s.max}" value="0" step="1">`;
    root.append(el);
    const input = $('input', el);
    const reset = () => {
      if (!state.base) return;
      state.adj[s.key] = 0;
      state.preset = null;
      commit();
    };
    input.addEventListener('input', () => {
      if (!state.base) return;
      state.adj[s.key] = Number(input.value);
      state.preset = null;
      $(`#out-${s.key}`).textContent = input.value;
      $$('.preset').forEach((p) => p.classList.remove('active'));
      scheduleRender();
    });
    input.addEventListener('change', () => state.base && commit());
    input.addEventListener('dblclick', reset);
    $('output', el).addEventListener('dblclick', reset);
  }
}

// ---------- Пресеты ----------

function buildPresets() {
  const root = $('#presets');
  for (const p of PRESETS) {
    const el = document.createElement('button');
    el.className = 'preset';
    el.dataset.name = p.name;
    el.innerHTML = `<canvas width="120" height="120"></canvas><span>${p.name}</span>`;
    el.addEventListener('click', () => {
      if (!state.base) return;
      state.adj = { ...p.adj };
      state.preset = p.name;
      commit();
    });
    root.append(el);
  }
}

function buildPresetThumbs() {
  const size = 120;
  const side = Math.min(state.base.width, state.base.height);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(
    state.base,
    (state.base.width - side) / 2, (state.base.height - side) / 2, side, side,
    0, 0, size, size,
  );
  const thumb = ctx.getImageData(0, 0, size, size);
  for (const el of $$('.preset')) {
    const p = PRESETS.find((x) => x.name === el.dataset.name);
    $('canvas', el).getContext('2d').putImageData(applyAdjustments(thumb, p.adj), 0, 0);
  }
}

// ---------- Трансформации ----------

function transform(kind) {
  const src = state.base;
  const rot = kind === 'rotL' || kind === 'rotR';
  const c = makeCanvas(rot ? src.height : src.width, rot ? src.width : src.height);
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  if (kind === 'rotL') ctx.rotate(-Math.PI / 2);
  if (kind === 'rotR') ctx.rotate(Math.PI / 2);
  if (kind === 'flipH') ctx.scale(-1, 1);
  if (kind === 'flipV') ctx.scale(1, -1);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  state.cutout = null;
  $('#bgOptions').hidden = true;
  setBase(c);
  commit();
}

// ---------- Обрезка ----------

const overlay = $('#cropOverlay');
const cropRect = $('#cropRect');

function aspectNorm() {
  // соотношение w/h в нормализованных координатах
  if (state.aspect === 'free') return null;
  return Number(state.aspect) * (state.base.height / state.base.width);
}

function fitCropToAspect() {
  const a = aspectNorm();
  if (!a) { state.crop = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 }; return; }
  let w = 0.9;
  let h = w / a;
  if (h > 0.9) { h = 0.9; w = h * a; }
  state.crop = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

function drawCrop() {
  const { x, y, w, h } = state.crop;
  Object.assign(cropRect.style, {
    left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`,
  });
}

function startCrop() {
  state.cropping = true;
  fitCropToAspect();
  drawCrop();
  overlay.hidden = false;
  $('#cropActions').hidden = false;
  $('#cropStart').hidden = true;
}

function endCrop() {
  state.cropping = false;
  overlay.hidden = true;
  $('#cropActions').hidden = true;
  $('#cropStart').hidden = false;
}

function applyCrop() {
  const { x, y, w, h } = state.crop;
  const src = state.base;
  const sx = Math.round(x * src.width);
  const sy = Math.round(y * src.height);
  const sw = Math.max(1, Math.round(w * src.width));
  const sh = Math.max(1, Math.round(h * src.height));
  const c = makeCanvas(sw, sh);
  c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  state.cutout = null;
  $('#bgOptions').hidden = true;
  setBase(c);
  commit();
  endCrop();
}

function initCropDrag() {
  let drag = null;
  overlay.addEventListener('pointerdown', (e) => {
    const handle = e.target.dataset.h;
    if (!handle && e.target !== cropRect && !cropRect.contains(e.target)) return;
    e.preventDefault();
    overlay.setPointerCapture(e.pointerId);
    drag = { handle: handle || 'move', sx: e.clientX, sy: e.clientY, start: { ...state.crop } };
  });
  overlay.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = overlay.getBoundingClientRect();
    const dx = (e.clientX - drag.sx) / r.width;
    const dy = (e.clientY - drag.sy) / r.height;
    const s = drag.start;
    const min = 0.05;
    let { x, y, w, h } = s;
    if (drag.handle === 'move') {
      x = Math.min(1 - w, Math.max(0, s.x + dx));
      y = Math.min(1 - h, Math.max(0, s.y + dy));
    } else {
      const west = drag.handle.includes('w');
      const north = drag.handle.includes('n');
      const right = s.x + s.w;
      const bottom = s.y + s.h;
      w = west ? Math.min(right, Math.max(min, s.w - dx)) : Math.min(1 - s.x, Math.max(min, s.w + dx));
      h = north ? Math.min(bottom, Math.max(min, s.h - dy)) : Math.min(1 - s.y, Math.max(min, s.h + dy));
      const a = aspectNorm();
      if (a) {
        // подгоняем под пропорцию, не выходя за границы
        const maxW = west ? right : 1 - s.x;
        const maxH = north ? bottom : 1 - s.y;
        if (w / h > a) w = h * a; else h = w / a;
        if (w > maxW) { w = maxW; h = w / a; }
        if (h > maxH) { h = maxH; w = h * a; }
      }
      x = west ? right - w : s.x;
      y = north ? bottom - h : s.y;
    }
    state.crop = { x, y, w, h };
    drawCrop();
  });
  const stop = () => { drag = null; };
  overlay.addEventListener('pointerup', stop);
  overlay.addEventListener('pointercancel', stop);
}

// ---------- ИИ ----------

async function runAutoEnhance() {
  state.adj = autoEnhance(state.previewSrc);
  state.preset = null;
  commit();
  toast('Готово: подобраны экспозиция, контраст и баланс белого');
}

async function runRemoveBackground() {
  busy(true, 'Загрузка модели…');
  try {
    const { removeBackground } = await loadAI();
    const source = state.base;
    const cut = await removeBackground(source, (key, p) => {
      const label = key.startsWith('fetch') ? 'Загрузка модели' : 'Удаление фона';
      $('#busyText').textContent = `${label}… ${Math.round(p * 100)}%`;
    });
    state.cutoutSource = source;
    state.cutout = cut;
    $('#bgOptions').hidden = false;
    applyBackground('transparent');
    toast('Фон удалён. Выберите новый фон или скачайте PNG');
  } catch (e) {
    console.error(e);
    toast(`Не удалось удалить фон: ${e.message || e}`, true);
  } finally {
    busy(false);
  }
}

function applyBackground(kind, color) {
  if (!state.cutout) return;
  const { width: w, height: h } = state.cutout;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  if (kind === 'white' || kind === 'color') {
    ctx.fillStyle = kind === 'white' ? '#ffffff' : color;
    ctx.fillRect(0, 0, w, h);
  } else if (kind === 'blur') {
    // Размываем уменьшенную копию — быстро и одинаково на любом размере
    const small = makeCanvas(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 8)));
    const sctx = small.getContext('2d');
    sctx.filter = 'blur(3px)';
    sctx.drawImage(state.cutoutSource, 0, 0, small.width, small.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, w, h);
  }
  ctx.drawImage(state.cutout, 0, 0);
  if (kind === 'transparent') $('#exportFormat').value = 'image/png';
  setBase(c);
  commit();
}

async function runAssistant(instruction) {
  const apiKey = $('#apiKey').value.trim();
  if (!apiKey) {
    $('.key-box').open = true;
    $('#apiKey').focus();
    toast('Введите API-ключ Anthropic', true);
    return;
  }
  if (!instruction) {
    toast('Опишите желаемый результат', true);
    return;
  }
  storage.set('anthropicKey', apiKey);
  busy(true, 'Claude смотрит на фото…');
  try {
    const { askClaude } = await loadAI();
    const result = await askClaude({ apiKey, canvas: view, instruction, current: state.adj });
    state.adj = result.adjustments;
    state.preset = null;
    commit();
    $('#aiExplanation').textContent = result.explanation;
    $('#aiCaption').textContent = result.caption;
    $('#aiResult').hidden = false;
  } catch (e) {
    console.error(e);
    toast(e.message || 'Ошибка ИИ-ассистента', true);
  } finally {
    busy(false);
  }
}

// ---------- Экспорт ----------

async function exportImage() {
  busy(true, 'Подготовка файла…');
  await nextFrame();
  try {
    const src = state.base;
    const ctx = src.getContext('2d', { willReadFrequently: true });
    const processed = applyAdjustments(ctx.getImageData(0, 0, src.width, src.height), state.adj);
    let out = makeCanvas(src.width, src.height);
    out.getContext('2d').putImageData(processed, 0, 0);
    const type = $('#exportFormat').value;
    if (type === 'image/jpeg') {
      const flat = makeCanvas(out.width, out.height);
      const fctx = flat.getContext('2d');
      fctx.fillStyle = '#fff';
      fctx.fillRect(0, 0, flat.width, flat.height);
      fctx.drawImage(out, 0, 0);
      out = flat;
    }
    const blob = await new Promise((r) => out.toBlob(r, type, 0.92));
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.fileName}-edited.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) {
    console.error(e);
    toast('Не удалось сохранить файл', true);
  } finally {
    busy(false);
  }
}

// ---------- События ----------

function initEvents() {
  $('#fileInput').addEventListener('change', (e) => {
    loadFile(e.target.files[0]);
    e.target.value = '';
  });

  const stage = $('#stage');
  const dz = $('#dropzone');
  stage.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  stage.addEventListener('dragleave', () => dz.classList.remove('over'));
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('over');
    loadFile(e.dataTransfer.files[0]);
  });
  document.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (item) loadFile(item.getAsFile());
  });

  $$('.tab').forEach((tab) => tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    $$('.tab-body').forEach((b) => { b.hidden = b.dataset.body !== tab.dataset.tab; });
    if (tab.dataset.tab !== 'transform' && state.cropping) endCrop();
  }));

  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#resetBtn').addEventListener('click', () => {
    if (!state.original) return;
    state.cutout = null;
    $('#bgOptions').hidden = true;
    setBase(state.original);
    state.adj = defaultAdjustments();
    state.preset = 'Оригинал';
    commit();
  });

  const cmp = $('#compareBtn');
  const down = (e) => { e.preventDefault(); showOriginal(); };
  const up = () => state.previewSrc && restoreView();
  cmp.addEventListener('pointerdown', down);
  cmp.addEventListener('pointerup', up);
  cmp.addEventListener('pointerleave', up);

  $('#exportBtn').addEventListener('click', exportImage);

  $$('[data-transform]').forEach((b) => b.addEventListener('click', () => transform(b.dataset.transform)));

  $$('#aspectChips .chip').forEach((chip) => chip.addEventListener('click', () => {
    $$('#aspectChips .chip').forEach((c) => c.classList.toggle('active', c === chip));
    state.aspect = chip.dataset.aspect;
    if (state.cropping) { fitCropToAspect(); drawCrop(); }
  }));
  $('#cropStart').addEventListener('click', startCrop);
  $('#cropApply').addEventListener('click', applyCrop);
  $('#cropCancel').addEventListener('click', endCrop);
  initCropDrag();

  $('#autoBtn').addEventListener('click', runAutoEnhance);
  $('#bgBtn').addEventListener('click', runRemoveBackground);
  $$('#bgOptions [data-bg]').forEach((b) => b.addEventListener('click', () => applyBackground(b.dataset.bg)));
  $('#bgColor').addEventListener('change', (e) => applyBackground('color', e.target.value));

  $('#aiBtn').addEventListener('click', () => runAssistant($('#aiPrompt').value.trim()));
  $('#aiPrompt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && state.base) runAssistant(e.target.value.trim());
  });
  $$('.suggestions .chip').forEach((chip) => chip.addEventListener('click', () => {
    $('#aiPrompt').value = chip.dataset.prompt;
    if (state.base) runAssistant(chip.dataset.prompt);
  }));
  $('#copyCaption').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#aiCaption').textContent);
      toast('Подпись скопирована');
    } catch {
      toast('Не удалось скопировать', true);
    }
  });
  $('#apiKey').value = storage.get('anthropicKey') || '';

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.target.matches('textarea, input[type=password]')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    if (k === 'o') { e.preventDefault(); $('#fileInput').click(); }
  });
}

buildSliders();
buildPresets();
initEvents();
