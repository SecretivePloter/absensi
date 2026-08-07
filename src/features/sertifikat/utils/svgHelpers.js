export function preProcessSVG(svgText) {
    // Fix 2 runs FIRST — 3-part out-of-visual-order split for "{{ Amat Baik }}":
    svgText = svgText.replace(
        /\{\{ A<\/text>(\s*<text\b[^>]*>) \}\}<\/text>(\s*<text\b[^>]*>)mat Baik(<\/text>)/,
        `{{ Amat Baik }}</text>$1</text>$2$3`
    );

    // Fix 1 runs SECOND — general 2-part split: "{{ " ends one <text>, "PLACEHOLDER }}" starts next.
    svgText = svgText.replace(
        /\{\{([^<}]*)<\/text>(\s*<text\b[^>]*>)\s*([^<}]*\}\})/g,
        (_, part1, tag2, part2) => `</text>${tag2}{{${part1}${part2}`
    );

    return svgText;
}

export function parseSVG(text) {
    return new DOMParser().parseFromString(text, 'image/svg+xml');
}

export function patchFonts(svgDoc) {
    const style = svgDoc.querySelector('style');
    if (!style) return;
    let css = style.textContent;
    css = css.replace(/font-family:'Barlow Condensed SemiBold'/g, "font-family:'Barlow Condensed'");
    css = css.replace(/font-family:'Barlow Condensed Medium'/g, "font-family:'Barlow Condensed'");
    style.textContent = css;
}

export function markPhotoPlaceholder(svgDoc) {
    svgDoc.querySelectorAll('image').forEach(el => {
        const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
        if (href.includes('ImgID3')) {
            el.setAttribute('data-is-photo', 'true');
        }
    });
}

// Convert image paths to base64 so SVG works self-contained
export async function patchImagePaths(svgDoc, folder, prefixMatch) {
    const NS = 'http://www.w3.org/1999/xlink';
    const els = Array.from(svgDoc.querySelectorAll('image'));
    const tasks = els.map(el => {
        // skip photo placeholder which will be handled by injectPhoto
        if (el.getAttribute('data-is-photo') || el.id === 'photo-placeholder') return Promise.resolve();

        const href = el.getAttributeNS(NS, 'href') || el.getAttribute('xlink:href') || el.getAttribute('href') || '';
        if (href.startsWith('data:')) return Promise.resolve();

        // strip the prefix artifact from CorelDraw
        let filename = href.split('/').pop().split('\\').pop();
        if (prefixMatch) {
            filename = filename.replace(new RegExp('^' + prefixMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '');
        }

        let relPath = folder + filename;

        return fetch(relPath)
            .then(r => r.blob())
            .then(blob => new Promise(res => {
                const reader = new FileReader();
                reader.onload = e => {
                    el.setAttributeNS(NS, 'xlink:href', e.target.result);
                    el.setAttribute('href', e.target.result);
                    res();
                };
                reader.readAsDataURL(blob);
            }))
            .catch(e => {
                console.warn("Failed to load image for svg patch:", relPath);
                el.setAttribute('href', relPath);
            });
    });
    await Promise.all(tasks);
}

export function replacePlaceholders(svgDoc, map) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const textEls = svgDoc.getElementsByTagNameNS(SVG_NS, 'text');

    const centerKeys = new Set([
        'NAMA PESERTA', 'NAMA', 'predikat', 'Level Bahasa Jepang',
        'lama Waktu Belajar', 'lulus/ tidak lulus', 'lulus/tidak',
        'Nomor Sertifikat 1', 'Nomor Sertifikat 2',
        'Tempat dan Tanggal Lahir Peserta',
    ]);

    for (const el of textEls) {
        if (el.closest('defs')) continue;

        for (const [key, value] of Object.entries(map)) {
            const escaped = key.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
            const re = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'gi');

            const nodes = [];
            el.childNodes.forEach(n => { if (n.nodeType === 3) nodes.push(n); });
            el.querySelectorAll('tspan').forEach(t =>
                t.childNodes.forEach(n => { if (n.nodeType === 3) nodes.push(n); })
            );

            let matched = false;
            nodes.forEach(n => {
                if (re.test(n.textContent)) {
                    n.textContent = n.textContent.replace(re, value);
                    matched = true;
                }
            });

            if (matched && centerKeys.has(key)) {
                const xAttr = parseFloat(el.getAttribute('x') || 0);
                if (!isNaN(xAttr)) {
                    el.setAttribute('text-anchor', 'middle');
                    el.querySelectorAll('tspan').forEach(t => {
                        if (t.hasAttribute('x')) t.setAttribute('x', xAttr);
                    });
                }
            }
        }
    }
}

export function injectPhoto(svgDoc, dataURL) {
    if (!dataURL) return;
    const NS = 'http://www.w3.org/1999/xlink';
    let target = null;
    svgDoc.querySelectorAll('image').forEach(el => {
        if (el.getAttribute('data-is-photo') || el.id === 'photo-placeholder') target = el;
        else {
            const href = el.getAttributeNS(NS, 'href') || el.getAttribute('xlink:href') || el.getAttribute('href') || '';
            if (href.includes('ImgID3')) target = el;
        }
    });
    if (target) {
        target.setAttributeNS(NS, 'xlink:href', dataURL);
        target.setAttribute('href', dataURL);
    }
}

export function applyStoredAdjustments(svgEl, page) {
    return new Promise(resolve => {
        const stored = JSON.parse(localStorage.getItem('ich_adj') || '{}')[page] || {};
        const adjEntries = Object.entries(stored);
        if (!adjEntries.length) { resolve(); return; }

        requestAnimationFrame(() => {
            const jobs = [];
            for (const [adjId, adj] of adjEntries) {
                const el = svgEl.querySelector(`[adj-id="${adjId}"]`);
                if (!el) continue;
                try { jobs.push({ el, adj, b: el.getBBox() }); } catch (e) { }
            }
            for (const { el, adj, b } of jobs) {
                const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
                const tx = (adj.dx + cx * (1 - adj.scale)).toFixed(2);
                const ty = (adj.dy + cy * (1 - adj.scale)).toFixed(2);
                const adj_tr = `translate(${tx},${ty}) scale(${adj.scale})`;
                const orig_tr = el.getAttribute('transform') || '';
                el.setAttribute('transform', orig_tr ? `${adj_tr} ${orig_tr}` : adj_tr);
            }
            resolve();
        });
    });
}

// Menambahkan atribut unik adj-id agar sinkron dengan adjust.html
export function assignAdjIds(doc) {
    const seen = new Map();
    doc.querySelectorAll('text, image').forEach(el => {
        let base;
        if (el.tagName.toLowerCase() === 'image') {
            const href = el.getAttribute('href') || el.getAttribute('xlink:href') || 'img';
            base = 'i:' + href.split('/').pop().split('\\').pop().replace(/[^\w.-]/g, '').slice(0, 40);
        } else {
            base = 't:' + (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        }
        const cnt = seen.get(base) || 0;
        seen.set(base, cnt + 1);
        el.setAttribute('adj-id', cnt === 0 ? base : `${base}__${cnt}`);
    });
}
