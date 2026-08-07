const fs = require('fs');
const { DOMParser } = require('xmldom');

function preProcessSVG(svgText) {
    svgText = svgText.replace(
        /\{\{ A<\/text>(\s*<text\b[^>]*>) \}\}<\/text>(\s*<text\b[^>]*>)mat Baik(<\/text>)/,
        `{{ Amat Baik }}</text>$1</text>$2$3`
    )
    svgText = svgText.replace(
        /\{\{([^<}]*)<\/text>(\s*<text\b[^>]*>)\s*([^<}]*\}\})/g,
        (_, part1, tag2, part2) => `</text>${tag2}{{${part1}${part2}`
    )
    return svgText
}

function assignAdjIds(doc) {
    const seen = new Map()
    doc.querySelectorAll('text').forEach(el => {
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)
        const base = 't:' + txt
        const cnt = seen.get(base) || 0; seen.set(base, cnt + 1)
        console.log(cnt === 0 ? base : `${base}__${cnt}`)
    })
}

const raw = fs.readFileSync('front.svg', 'utf-8');
const p = new DOMParser();
const doc = p.parseFromString(preProcessSVG(raw), 'image/svg+xml');

assignAdjIds(doc);
