/* Shared SVG geometry and self-contained rendering for generator + adjuster. */
window.CertificateCore = (() => {
  const NS = 'http://www.w3.org/2000/svg', XL = 'http://www.w3.org/1999/xlink';
  const blankPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=';
  const cache = new Map();
  async function fetchOK(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`Tidak dapat memuat ${url} (HTTP ${r.status})`);
    return r;
  }
  function readBlob(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = r.onabort = () => reject(new Error('File tidak dapat dibaca.'));
      r.readAsDataURL(blob);
    });
  }
  function dataURL(url) {
    if (!cache.has(url)) cache.set(url, fetchOK(url).then(r => r.blob()).then(readBlob).catch(e => { cache.delete(url); throw e; }));
    return cache.get(url);
  }
  function preProcessSVG(s) {
    return s.replace(/\{\{([^<}]*)<\/text>(\s*<text\b[^>]*>)\s*([^<}]*\}\})/g,
      (_, a, tag, b) => `</text>${tag}{{${a}${b}`);
  }
  function parseSVG(s) {
    const d = new DOMParser().parseFromString(s, 'image/svg+xml');
    if (d.querySelector('parsererror') || d.documentElement.localName !== 'svg') throw new Error('Template SVG tidak valid.');
    return d;
  }
  function assignAdjIds(d) {
    const seen = new Map();
    for (const el of d.querySelectorAll('text, image')) {
      if (el.hasAttribute('adj-id')) continue;
      const href = el.getAttributeNS(XL, 'href') || el.getAttribute('href') || '';
      const base = el.localName === 'image'
        ? 'i:' + href.replace(/\\/g, '/').split('/').pop().replace(/[^\w.-]/g, '').slice(0, 40)
        : 't:' + el.textContent.replace(/\s+/g, ' ').trim().slice(0, 40);
      const n = seen.get(base) || 0; seen.set(base, n + 1);
      el.setAttribute('adj-id', n ? `${base}__${n}` : base);
      if (el.localName === 'image' && href.includes('Bani_ImgID3')) el.dataset.isPhoto = 'true';
    }
  }
  function patchFonts(d) {
    if (d.documentElement.dataset.fontsPatched) return;
    d.documentElement.dataset.fontsPatched = 'true';
    const prefix = d.documentElement.textContent.includes('NAMA PESERTA') ? 'front-' : 'back-';
    for (const style of d.querySelectorAll('style')) {
      style.textContent = style.textContent.replace(/@font-face\s*\{[^}]*\}/g, '')
        .replace(/Barlow Condensed (?:SemiBold|Medium)/g, 'Barlow Condensed')
        .replace(/\.(fil\d+|fnt\d+|str\d+)/g, '.' + prefix + '$1');
    }
    for (const el of d.querySelectorAll('[class]')) el.setAttribute('class', el.getAttribute('class').replace(/\b(fil\d+|fnt\d+|str\d+)\b/g, prefix + '$1'));
  }
  let embeddedFonts;
  async function embedFonts(d) {
    if (!embeddedFonts) embeddedFonts = fetchOK('vendor/fonts.json').then(r => r.json()).then(fs => Promise.all(fs.map(async f =>
      `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};src:url('${await dataURL(f.file)}')}`
    ))).then(a => a.join('\n')).catch(e => { embeddedFonts = null; throw e; });
    if (!d.querySelector('[data-embedded-fonts]')) {
      const s = d.createElementNS(NS, 'style'); s.dataset.embeddedFonts = 'true'; s.textContent = await embeddedFonts;
      d.documentElement.appendChild(s);
    }
  }
  async function patchImagePaths(d, folder, prefix = '') {
    assignAdjIds(d); // Always before embedding: IDs cannot depend on photo bytes.
    await Promise.all([...d.querySelectorAll('image')].map(async el => {
      const href = el.getAttributeNS(XL, 'href') || el.getAttribute('href') || '';
      if (href.startsWith('data:')) return;
      let name = href.replace(/\\/g, '/').split('/').pop();
      if (name.startsWith(prefix)) name = name.slice(prefix.length);
      const value = await dataURL(folder + name);
      el.setAttributeNS(XL, 'xlink:href', value); el.setAttribute('href', value);
    }));
    await embedFonts(d);
  }
  function injectPhoto(d, url) {
    assignAdjIds(d);
    const el = d.querySelector('[data-is-photo]');
    if (!el) throw new Error('Frame foto peserta tidak ditemukan.');
    el.setAttributeNS(XL, 'xlink:href', url || blankPhoto); el.setAttribute('href', url || blankPhoto);
  }
  function replacePlaceholders(d, map) {
    for (const el of d.querySelectorAll('text')) {
      if (el.closest('defs')) continue;
      const original = el.textContent;
      const walker = d.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        walker.currentNode.textContent = walker.currentNode.textContent.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, key) => {
          const found = Object.keys(map).find(k => k.toLowerCase() === key.trim().toLowerCase());
          return found === undefined ? match : String(map[found] ?? '');
        });
      }
      // Preserve existing tspan coordinates, especially the centered paragraph.
      if (!original.includes('{{')) continue;
      const key = original.trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/)?.[1].trim().toLowerCase();
      if (['nama peserta', 'nama', 'nomor sertifikat 1', 'nomor sertifikat 2'].includes(key)) {
        el.setAttribute('text-anchor', 'middle');
        el.dataset.centerPage = 'true';
        el.dataset.maxWidth = key.startsWith('nama') ? '8500' : '7000';
      } else if (key?.startsWith('nilai')) {
        el.setAttribute('text-anchor', 'middle');
      } else if (key === 'lulus/tidak') {
        el.setAttribute('text-anchor', 'middle');
        el.setAttribute('x', '9200');
        el.dataset.maxWidth = '1450';
      }
    }
  }
  async function layout(svg) {
    // Load actual font faces before measuring (fonts.ready alone can resolve too early).
    await Promise.all(['600 16px "Barlow Condensed"', '400 16px "Barlow Semi Condensed"', '700 16px "Barlow Semi Condensed"', '400 16px "Libre Bodoni"'].map(f => document.fonts.load(f)));
    await document.fonts.ready;
    for (const el of svg.querySelectorAll('[data-center-page]')) {
      const m = svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
      const y = +el.getAttribute('y') || 0;
      el.setAttribute('x', (svg.viewBox.baseVal.width / 2 - m.c * y - m.e) / m.a);
    }
    for (const el of svg.querySelectorAll('text[data-max-width], text > tspan[x]')) {
      const max = +(el.dataset.maxWidth || 10000), w = el.getComputedTextLength();
      if (w > max) { el.setAttribute('textLength', max); el.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
    }
  }
  function remember(svg) {
    for (const el of svg.querySelectorAll('[adj-id]')) {
      const b = el.getBBox(), m = el.transform.baseVal.consolidate()?.matrix || new DOMMatrix();
      const p = new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(m);
      el.dataset.cx = p.x; el.dataset.cy = p.y; el.dataset.otr = el.getAttribute('transform') || '';
    }
  }
  function applyAdjTransform(el, dx, dy, scale) {
    if (![dx, dy, scale].every(Number.isFinite) || scale < 0.1 || scale > 4 || Math.abs(dx) > 5000 || Math.abs(dy) > 5000) throw new Error('Koordinat penyesuaian tidak valid.');
    const cx = +el.dataset.cx, cy = +el.dataset.cy;
    el.setAttribute('transform', `translate(${dx + cx * (1 - scale)},${dy + cy * (1 - scale)}) scale(${scale}) ${el.dataset.otr || ''}`);
  }
  function readAdjustments() {
    try {
      const stored = localStorage.getItem('ich_adj');
      const configured = window.ICHIKARA_CERTIFICATE_CONFIG?.defaultAdjustments ||
        window.ICHIKARA_CERTIFICATE_DEFAULT_ADJUSTMENTS || {};
      const a = stored === null ? configured : JSON.parse(stored);
      validateAdjustments(a);
      return { front: a.front || {}, back: a.back || {} };
    } catch { return { front: {}, back: {} }; }
  }
  function validateAdjustments(a) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) throw new Error('Format penyesuaian harus objek.');
    for (const page of ['front', 'back']) {
      if (a[page] === undefined) continue;
      if (!a[page] || typeof a[page] !== 'object' || Array.isArray(a[page])) throw new Error('Format halaman penyesuaian tidak valid.');
      for (const v of Object.values(a[page])) {
        if (!v || ![v.dx, v.dy, v.scale].every(Number.isFinite) || Math.abs(v.dx) > 5000 || Math.abs(v.dy) > 5000 || v.scale < 0.1 || v.scale > 4) throw new Error('Koordinat harus angka: x/y -5000 sampai 5000, skala 0.1 sampai 4.');
      }
    }
  }
  function applyStored(svg, page) {
    remember(svg);
    const a = readAdjustments()[page];
    for (const el of svg.querySelectorAll('[adj-id]')) {
      const adj = a[el.getAttribute('adj-id')];
      if (adj) applyAdjTransform(el, Number(adj.dx), Number(adj.dy), Number(adj.scale));
    }
  }
  async function cropPhoto(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Gunakan foto JPG, PNG, atau WebP.');
    if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Ukuran foto harus 1 byte sampai 10 MB.');
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const ratio = 1600.96 / 2001.59, c = document.createElement('canvas');
      c.width = 960; c.height = Math.round(960 / ratio);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h || w * h > 60000000) throw new Error('Resolusi foto terlalu besar atau tidak valid.');
      const sw = Math.min(w, h * ratio), sh = sw / ratio, ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.94);
    } finally { URL.revokeObjectURL(url); }
  }
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image(), timer = setTimeout(() => { img.src = ''; reject(new Error('Waktu memuat gambar habis.')); }, 15000);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('Gambar rusak atau format tidak didukung.')); };
      img.src = url;
    });
  }
  async function svgToCanvas(svg, w = 2339, h = 1654) {
    const copy = svg.cloneNode(true);
    copy.setAttribute('width', w); copy.setAttribute('height', h); copy.style.width = w + 'px'; copy.style.height = h + 'px';
    copy.querySelectorAll('.adj-sel-rect').forEach(e => e.remove());
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
    try {
      const img = await loadImage(url), c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }
  async function prepare(page, map, photo) {
    const d = parseSVG(preProcessSVG(await (await fetchOK(page + '.svg')).text()));
    assignAdjIds(d); patchFonts(d); replacePlaceholders(d, map);
    if (page === 'front') injectPhoto(d, photo);
    await patchImagePaths(d, page + '_images/', page === 'front' ? 'Backup_of_1. Bani_' : 'Belakang_');
    return document.importNode(d.documentElement, true);
  }
  function createPDF(canvases) {
    if (canvases.length !== 2 || canvases.some(c => !c?.width)) throw new Error('Dua halaman preview harus siap sebelum mengunduh.');
    if (!window.jspdf?.jsPDF) throw new Error('Pustaka PDF lokal gagal dimuat. Muat ulang halaman.');
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    canvases.forEach((c, i) => { if (i) pdf.addPage(); pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210); });
    return pdf;
  }
  return { fetchOK, readBlob, preProcessSVG, parseSVG, assignAdjIds, patchFonts, patchImagePaths, injectPhoto, replacePlaceholders, layout, remember, applyAdjTransform, readAdjustments, validateAdjustments, applyStored, cropPhoto, svgToCanvas, prepare, createPDF };
})();
