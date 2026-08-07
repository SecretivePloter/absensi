const fs = require('fs');

let raw = fs.readFileSync('front.svg', 'utf-8');
const tags = [...raw.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)];
const textNodes = tags.map(m => {
    // Strip tspan tags
    let textContent = m[1].replace(/<tspan[^>]*>/gi, '').replace(/<\/tspan>/gi, '');
    return textContent;
});

const out = [];
textNodes.forEach(content => {
    const txt = (content || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    out.push('t:' + txt);
});
fs.writeFileSync('ids_output.txt', out.join('\n'));
