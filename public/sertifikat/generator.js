const Core = window.CertificateCore;
let photoDataURL = null, photoTask = Promise.resolve(), photoVersion = 0;
let busy = false, revision = 0, preview = null;
const $ = id => document.getElementById(id);
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function toast(message, type = 'ok') {
  $('statusMessage').textContent = message;
  $('statusMessage').style.color = type === 'err' ? '#b91c1c' : '#047857';
}
function invalidate() {
  revision++; preview = null; $('downloadBtn').disabled = true;
  toast('Data berubah. Klik Generate Preview untuk memperbarui sertifikat.');
}
function setBusy(value) {
  busy = value;
  $('generateBtn').disabled = value;
  $('downloadBtn').disabled = value || !preview;
  $('generateBtn').textContent = value ? 'Memproses...' : 'Generate Preview';
}
function fmtDate(value) {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : String(value);
}
function isoDate(value) {
  if (!value) return '';
  if (typeof value === 'number') return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const m = String(value).match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  const month = m ? BULAN.findIndex(b => b.toLowerCase() === m[2].toLowerCase()) : -1;
  if (m && month >= 0) return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  throw new Error('Tanggal harus YYYY-MM-DD atau tanggal Indonesia, misalnya 25 Juni 2026.');
}
function fileNameFor(data) {
  const safe = s => String(s || '').replace(/[^\w\s-]/g, '_').trim();
  return `Sertifikat_${safe(data.nama) || 'Peserta'}${data.nomor ? '_' + safe(data.nomor) : ''}.pdf`;
}
function formData() {
  const d = {};
  for (const k of ['nama', 'nomor', 'lahir', 'level', 'predikat', 'lama', 'lulus', 'selesai', 'terbit', 'n1', 'n2', 'n3', 'n4', 'n5']) d[k] = $('f-' + k).value.trim();
  if (!d.nama) throw new Error('Nama peserta wajib diisi.');
  // Template: four category scores /25 and a total /100.
  for (const k of ['n1', 'n2', 'n3', 'n4', 'n5']) {
    const max = k === 'n5' ? 100 : 25;
    if (d[k] && (!Number.isFinite(Number(d[k])) || Number(d[k]) < 0 || Number(d[k]) > max)) throw new Error(`Nilai ${k.slice(1)} harus 0 sampai ${max}.`);
  }
  d.n5 = ['n1', 'n2', 'n3', 'n4'].every(k => d[k] !== '') ? String(['n1', 'n2', 'n3', 'n4'].reduce((sum, k) => sum + Number(d[k]), 0)) : '';
  return d;
}
async function renderCertificate(d, photo, adjustments) {
  if (adjustments) Core.validateAdjustments(adjustments);
  const front = await Core.prepare('front', {
    'NAMA PESERTA': d.nama, 'Nomor Sertifikat 1': 'No.DK.01.03/278/IX/2024', 'Nomor Sertifikat 2': d.nomor,
    'Tempat dan Tanggal Lahir Peserta': d.lahir, 'Level Bahasa Jepang': d.level, predikat: d.predikat,
    'lama Waktu Belajar': d.lama, 'lulus/ tidak lulus': d.lulus,
    'Tanggal Selesai Kursus': fmtDate(d.selesai), 'Tanggal terbit Sertifikat': `Cikarang, ${fmtDate(d.terbit)}`,
  }, photo);
  const back = await Core.prepare('back', {
    NAMA: d.nama, 'Tanggal terbit sertifikat': `Cikarang, ${fmtDate(d.terbit)}`, 'lulus/tidak': d.lulus,
    nilai1: d.n1, nilai2: d.n2, nilai3: d.n3, nilai4: d.n4, nilai5: d.n5,
  });
  // Fixed-size offscreen stage is measurable even inside the gallery worker.
  const stage = document.createElement('div');
  stage.style.cssText = 'position:fixed;left:-20000px;top:0;width:1169px;visibility:hidden;pointer-events:none';
  document.body.appendChild(stage);
  const canvases = [];
  try {
    for (const [i, svg] of [front, back].entries()) {
      svg.style.cssText = 'display:block;width:1169px;height:auto'; stage.appendChild(svg);
      await Core.layout(svg); Core.applyStored(svg, i ? 'back' : 'front', adjustments);
      canvases.push(await Core.svgToCanvas(svg));
    }
  } finally { stage.remove(); }
  return { canvases, svgs: [front, back], data: d, fileName: fileNameFor(d) };
}
async function generatePreview() {
  if (busy) return;
  setBusy(true); preview = null;
  try {
    let pending;
    do { pending = photoTask; await pending; } while (pending !== photoTask);
    const current = revision, result = await renderCertificate(formData(), photoDataURL);
    if (current !== revision) throw new Error('Data berubah saat diproses. Klik Generate Preview lagi.');
    $('previewContent').replaceChildren();
    result.canvases.forEach((canvas, i) => {
      const label = document.createElement('div'); label.className = 'page-label'; label.textContent = i ? 'Halaman Belakang' : 'Halaman Depan';
      const card = document.createElement('div'); card.className = 'svg-card'; card.id = i ? 'svgBack' : 'svgFront';
      canvas.style.cssText = 'display:block;width:100%;height:auto'; card.appendChild(canvas);
      $('previewContent').append(label, card);
    });
    preview = result; toast('Preview siap. PDF akan memakai dua halaman yang tampil ini.');
  } catch (e) { toast(e.message, 'err'); }
  finally { setBusy(false); }
}
async function archivePDF(pdf, fileName) {
  const packageArchive = window.ICHIKARA_CERTIFICATE_CONFIG?.archive;
  if (packageArchive?.enabled === false) return { skipped: true };
  const config = packageArchive?.url && packageArchive?.anonKey ? packageArchive : window.ICHIKARA_SUPABASE_CONFIG;
  if (!window.supabase || !config?.url || !config?.anonKey) throw new Error('Koneksi arsip tidak tersedia.');
  const client = window.__certificateStorage ||= window.supabase.createClient(config.url, config.anonKey, { db: { schema: 'ichikara' } });
  const { error } = await client.storage.from('ichikara_sertifikat_arsip').upload(fileName, pdf.output('blob'), { upsert: true });
  if (error) throw error;
}
function reportArchive(pdf, fileName) {
  if (window.ICHIKARA_CERTIFICATE_CONFIG?.archive?.enabled === false) return;
  // Download must not wait for a remote archive request.
  const current = revision;
  let timer;
  Promise.race([archivePDF(pdf, fileName), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Arsip belum terkonfirmasi setelah 15 detik.')), 15000); })])
    .then(() => { if (current === revision) toast('PDF diunduh dan arsip berhasil disimpan.'); })
    .catch(e => { if (current === revision) toast('PDF sudah diunduh. Arsip belum tersimpan: ' + e.message, 'err'); })
    .finally(() => clearTimeout(timer));
}
async function downloadPDF() {
  if (busy || !preview) return;
  setBusy(true);
  try {
    const result = preview, pdf = Core.createPDF(result.canvases);
    await pdf.save(result.fileName, { returnPromise: true });
    toast('PDF berhasil diunduh.'); reportArchive(pdf, result.fileName);
  } catch (e) { toast('Gagal membuat PDF: ' + e.message, 'err'); }
  finally { setBusy(false); }
}
function cropAndStore(file) {
  const ticket = ++photoVersion;
  invalidate(); toast('Memproses foto...');
  photoTask = Core.cropPhoto(file).then(url => {
    if (ticket !== photoVersion) return;
    photoDataURL = url; $('photoThumb').src = url; $('photoThumb').style.display = 'block';
    $('photoLabel').textContent = 'Foto siap'; toast('Foto siap. Klik Generate Preview.');
  }).catch(e => { if (ticket === photoVersion) toast(e.message + (photoDataURL ? ' Foto sebelumnya tetap digunakan.' : ''), 'err'); });
  return photoTask;
}
$('photoInput').addEventListener('change', e => { const file = e.target.files[0]; e.target.value = ''; if (file) cropAndStore(file); });
const drop = $('photoDrop');
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragover'); if (e.dataTransfer.files[0]) cropAndStore(e.dataTransfer.files[0]); });
$('removePhoto').addEventListener('click', () => {
  photoVersion++; photoTask = Promise.resolve(); photoDataURL = null; $('photoThumb').removeAttribute('src');
  $('photoThumb').style.display = 'none'; $('photoLabel').textContent = 'Klik atau seret foto peserta'; invalidate();
});
document.querySelectorAll('.field input, .field select').forEach(el => el.addEventListener('input', invalidate));
function updateTotal() {
  const values = [1, 2, 3, 4].map(i => $('f-n' + i).value.trim());
  $('f-n5').value = values.every(v => v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 25) ? String(values.reduce((sum, v) => sum + Number(v), 0)) : '';
}
$('f-n5').readOnly = true;
[1, 2, 3, 4].forEach(i => { const el = $('f-n' + i); el.type = 'number'; el.min = 0; el.max = 25; el.step = 'any'; el.addEventListener('input', updateTotal); });
window.addEventListener('storage', e => { if (e.key === 'ich_adj') invalidate(); });
function fillTestData() {
  const d = { nama: 'Kresna Wirawan', nomor: 'ICH-2026-001', lahir: 'Jakarta, 4 Juni 2000', level: 'N5 (Dasar)', predikat: 'Amat Baik', lama: '120', lulus: 'LULUS', selesai: '2026-06-20', terbit: '2026-06-25', n1: '22', n2: '20', n3: '23', n4: '24', n5: '89' };
  Object.entries(d).forEach(([k, v]) => $('f-' + k).value = v); invalidate();
}
let workerQueue = Promise.resolve();
function acceptsParentMessage(event) {
  if (event.source !== window.parent || event.source === window) return false;
  if (event.origin === location.origin) return true;
  const allowed = window.ICHIKARA_CERTIFICATE_CONFIG?.integration?.allowedParentOrigins || [];
  return Array.isArray(allowed) && allowed.includes(event.origin);
}
window.addEventListener('message', event => {
  if (!acceptsParentMessage(event) || event.data?.type !== 'WORKER_GENERATE_PDF') return;
  const message = event.data;
  workerQueue = workerQueue.then(async () => {
    try {
      const p = message.payload || {};
      const d = { nama: p.nama_peserta || p.nama || '', nomor: p.nomor || '', lahir: p.ttl || '', level: p.level || '', lama: p.lama || '', lulus: p.lulus || '', predikat: p.predikat || '', selesai: fmtDate(isoDate(p.tgl_selesai)), terbit: fmtDate(isoDate(p.tgl_terbit)) };
      if (!d.nama.trim()) throw new Error('Nama peserta wajib diisi.');
      for (let i = 1; i <= 5; i++) d['n' + i] = p['n' + i] ?? '';
      const values = [d.n1, d.n2, d.n3, d.n4];
      if (values.some(v => v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 25))) throw new Error('Data nilai lama tidak sesuai: setiap kategori harus 0 sampai 25. Perbaiki data peserta terlebih dahulu.');
      if (p.scoreSource === 'excel') {
        if (values.some(v => v === '') || d.n5 === '' || !Number.isFinite(Number(d.n5)) || Number(d.n5) < 0 || Number(d.n5) > 100) throw new Error('Nilai sertifikat Excel tidak lengkap atau tidak valid.');
        // The approved Summary may be manually entered or differently rounded in Excel.
        // Preserve its formatted text instead of recomputing from displayed category scores.
      } else {
        d.n5 = values.every(v => v !== '') ? String(values.reduce((sum, v) => sum + Number(v), 0)) : '';
      }
      let photo = null;
      if (message.photoDataUrl) {
        if (!/^data:image\/(png|jpeg|webp);base64,/.test(message.photoDataUrl)) throw new Error('Format foto worker tidak didukung.');
        photo = await Core.cropPhoto(await (await fetch(message.photoDataUrl)).blob());
      }
      const result = await renderCertificate(d, photo, p.calibration), pdf = Core.createPDF(result.canvases);
      event.source.postMessage({ type: 'WORKER_PDF_DONE', requestId: message.requestId, nomor: p.nomor, fileName: result.fileName, pdfDataUrl: await Core.readBlob(pdf.output('blob')), success: true }, event.origin);
    } catch (e) {
      event.source.postMessage({ type: 'WORKER_PDF_DONE', requestId: message.requestId, nomor: message.payload?.nomor, success: false, error: e.message }, event.origin);
    }
  });
});
