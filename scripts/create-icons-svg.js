/* Fallback: creates simple SVG-based icons without canvas dependency */
'use strict';
const fs   = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../public/icons');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="ic" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00bfff"/>
      <stop offset="100%" stop-color="#38ef7d"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${s*0.2}" fill="url(#bg)"/>
  <circle cx="${s*0.5}" cy="${s*0.42}" r="${s*0.28}" fill="url(#ic)"/>
  <path d="M${s*0.3} ${s*0.55} L${s*0.25} ${s*0.72} L${s*0.48} ${s*0.6}" fill="url(#ic)"/>
  <circle cx="${s*0.38}" cy="${s*0.40}" r="${s*0.055}" fill="#0f172a"/>
  <circle cx="${s*0.5}"  cy="${s*0.37}" r="${s*0.055}" fill="#0f172a"/>
  <circle cx="${s*0.62}" cy="${s*0.40}" r="${s*0.055}" fill="#0f172a"/>
</svg>`;

for (const size of [192, 512]) {
  fs.writeFileSync(path.join(OUT, `icon-${size}.svg`), svg(size));
  console.log(`Created icon-${size}.svg`);
}

/* Also write a tiny PNG placeholder (1x1 transparent) as fallback */
const PNG1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
for (const size of [192, 512]) {
  const p = path.join(OUT, `icon-${size}.png`);
  if (!fs.existsSync(p)) { fs.writeFileSync(p, PNG1x1); console.log(`Created placeholder icon-${size}.png`); }
}
console.log('Icons ready ✅');
