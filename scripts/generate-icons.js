/* Run: node scripts/generate-icons.js */
/* Generates PNG icons for the PWA using Canvas */
'use strict';
const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

const SIZES = [192, 512];
const OUT   = path.join(__dirname, '../public/icons');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

for (const size of SIZES) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const grad   = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();
  const g2 = ctx.createLinearGradient(size*0.1, size*0.1, size*0.9, size*0.9);
  g2.addColorStop(0, '#00bfff');
  g2.addColorStop(1, '#38ef7d');
  ctx.fillStyle = g2;
  ctx.font = `bold ${size * 0.42}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('💬', size/2, size/2 + size*0.03);
  const buf  = canvas.toBuffer('image/png');
  const file = path.join(OUT, `icon-${size}.png`);
  fs.writeFileSync(file, buf);
  console.log('Created:', file);
}
console.log('Icons generated ✅');
