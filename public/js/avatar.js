/* ── Avatar Editor (Canvas-based circular crop) ──────────────── */
'use strict';

const AvatarEditor = (() => {
  let _rawImg = null;
  let _onSave = null;
  const S = 200;

  function toggle(editorId) {
    const ed = document.getElementById(editorId);
    if (!ed) return;
    const open = ed.style.display !== 'none';
    ed.style.display = open ? 'none' : '';
    if (!open) render(editorId.replace('editor', 'canvas'));
  }

  function loadImage(input, canvasId) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        _rawImg = img;
        const pre = canvasId + '-zoom';
        const xEl = canvasId + '-x';
        const yEl = canvasId + '-y';
        const z = document.getElementById(pre);
        const x = document.getElementById(xEl);
        const y = document.getElementById(yEl);
        if (z) z.value = '1';
        if (x) x.value = '0';
        if (y) y.value = '0';
        render(canvasId);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  function render(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const zoom = parseFloat(document.getElementById(canvasId + '-zoom')?.value) || 1;
    const offX = parseInt(document.getElementById(canvasId + '-x')?.value)     || 0;
    const offY = parseInt(document.getElementById(canvasId + '-y')?.value)     || 0;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S/2, S/2, S/2, 0, Math.PI * 2);
    ctx.clip();
    if (_rawImg) {
      const scale = Math.max(S / _rawImg.width, S / _rawImg.height) * zoom;
      ctx.drawImage(_rawImg,
        S/2 - (_rawImg.width  * scale / 2) + offX,
        S/2 - (_rawImg.height * scale / 2) + offY,
        _rawImg.width  * scale,
        _rawImg.height * scale
      );
    } else {
      ctx.fillStyle = 'rgba(0,191,255,0.15)';
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '70px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const name = window._session?.user?.name || '?';
      ctx.fillText(name.charAt(0).toUpperCase(), S/2, S/2);
    }
    ctx.restore();
  }

  function save(canvasId, onSave) {
    if (!_rawImg) { Toast.show('Sube una foto primero', 'warn'); return; }
    const canvas  = document.getElementById(canvasId);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    if (typeof onSave === 'function') onSave(dataUrl);
  }

  function buildHTML(prefix, onSaveCallback) {
    _onSave = onSaveCallback;
    return `
<div class="acct-avatar-wrap">
  <div class="acct-avatar" id="${prefix}-display">?</div>
  <button type="button" class="acct-avatar-edit-btn" onclick="AvatarEditor.toggle('${prefix}-editor')" title="Cambiar foto">✏️</button>
</div>
<div id="${prefix}-editor" style="display:none;width:100%;margin:.8rem 0 .3rem;">
  <canvas id="${prefix}-canvas" width="${S}" height="${S}"></canvas>
  <div style="margin-top:.8rem;">
    <label class="avatar-ctrl-label">🔍 Zoom</label>
    <input type="range" id="${prefix}-canvas-zoom" min="0.5" max="4" step="0.05" value="1" oninput="AvatarEditor.render('${prefix}-canvas')" class="avatar-range"/>
  </div>
  <div style="display:flex;gap:.8rem;margin-top:.4rem;">
    <div style="flex:1;"><label class="avatar-ctrl-label">↔ X</label>
      <input type="range" id="${prefix}-canvas-x" min="-200" max="200" value="0" oninput="AvatarEditor.render('${prefix}-canvas')" class="avatar-range"/></div>
    <div style="flex:1;"><label class="avatar-ctrl-label">↕ Y</label>
      <input type="range" id="${prefix}-canvas-y" min="-200" max="200" value="0" oninput="AvatarEditor.render('${prefix}-canvas')" class="avatar-range"/></div>
  </div>
  <div style="display:flex;gap:.6rem;margin-top:.8rem;">
    <button type="button" class="btn btn-sm" style="flex:1;" onclick="document.getElementById('${prefix}-file').click()">📷 Foto</button>
    <input type="file" id="${prefix}-file" accept="image/*" style="display:none" onchange="AvatarEditor.loadImage(this,'${prefix}-canvas')"/>
    <button type="button" class="btn btn-sm" style="flex:1;" onclick="AvatarEditor.save('${prefix}-canvas', window._avatarSaveCallback)">💾 Guardar</button>
    <button type="button" class="btn btn-sm btn-secondary" onclick="AvatarEditor.toggle('${prefix}-editor')">✕</button>
  </div>
</div>`;
  }

  function setDisplay(prefix, dataUrl, name) {
    const el = document.getElementById(prefix + '-display');
    if (!el) return;
    if (dataUrl) el.innerHTML = `<img src="${dataUrl}" alt="avatar"/>`;
    else el.textContent = (name || '?').charAt(0).toUpperCase();
  }

  function reset() { _rawImg = null; }

  return { toggle, loadImage, render, save, buildHTML, setDisplay, reset };
})();

window.AvatarEditor = AvatarEditor;
