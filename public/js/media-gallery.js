/* ── Media Gallery (MediaFire-style) ───────────────────────────────── */
'use strict';

const MediaGallery = (() => {
  let _mediaFiles = [];
  let _currentFilter = 'all';
  let _currentView = 'grid';

  function _h() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (window._session?.token || '') };
  }

  function _isAdmin() {
    const r = window._session?.user?.role;
    return r === 'admin' || r === 'superadmin';
  }

  async function loadMedia() {
    if (!_isAdmin()) return;
    try {
      const res = await fetch('/api/admin/media', { headers: _h() });
      const data = await res.json();
      if (!data.ok) {
        console.error('[MediaGallery] Failed to load media:', data.msg);
        return;
      }
      _mediaFiles = data.files || [];
      renderGallery();
    } catch (e) {
      console.error('[MediaGallery] Error loading media:', e);
    }
  }

  function filter(filter) {
    _currentFilter = filter;
    document.querySelectorAll('.media-filters .filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderGallery();
  }

  function setView(view) {
    _currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    const gallery = document.getElementById('media-gallery');
    if (view === 'list') {
      gallery.classList.add('list-view');
    } else {
      gallery.classList.remove('list-view');
    }
  }

  function renderGallery() {
    const el = document.getElementById('media-gallery');
    if (!el) {
      console.error('[MediaGallery] media-gallery element not found');
      return;
    }
    if (!_mediaFiles.length) {
      el.innerHTML = '<div class="media-empty">No hay archivos compartidos</div>';
      return;
    }

    const filtered = _mediaFiles.filter(f => {
      if (_currentFilter === 'all') return true;
      const ext = f.name.split('.').pop().toLowerCase();
      if (_currentFilter === 'image') return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
      if (_currentFilter === 'video') return ['mp4', 'webm', 'mov'].includes(ext);
      if (_currentFilter === 'document') return ['pdf', 'doc', 'docx', 'txt', 'zip'].includes(ext);
      return true;
    });

    if (!filtered.length) {
      el.innerHTML = '<div class="media-empty">No hay archivos de este tipo</div>';
      return;
    }

    el.innerHTML = filtered.map(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
      const typeIcon = isImage ? '' :
                       ext === 'mp4' || ext === 'webm' || ext === 'mov' ? '🎬' :
                       ext === 'mp3' || ext === 'wav' || ext === 'ogg' ? '🎵' : '📄';
      const dateStr = f.message_created ? new Date(f.message_created).toLocaleString() : new Date(f.created).toLocaleString();
      const sizeStr = f.size < 1024 * 1024 ? (f.size / 1024).toFixed(1) + ' KB' : (f.size / (1024 * 1024)).toFixed(1) + ' MB';

      const imageContent = isImage 
        ? `<img src="${f.url}" alt="${f.name}" onerror="this.style.display='none';this.parentNode.textContent='🖼️'"/>`
        : typeIcon;

      return `
      <div class="media-card" oncontextmenu="MediaGallery.showContextMenu(event, '${f.url}', '${f.name}')">
        <div class="media-card-image">${imageContent}</div>
        <div class="media-card-info">
          <div class="media-card-name" title="${f.name}">${f.name}</div>
          <div class="media-card-meta">${sizeStr} • ${dateStr}</div>
          <div class="media-card-sender">Enviado por: ${f.sender_name || 'Desconocido'}</div>
          <div class="media-card-actions">
            <button class="media-card-btn" onclick="MediaGallery.downloadFile('${f.url}', '${f.name}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Descargar
            </button>
            <button class="media-card-btn secondary" onclick="MediaGallery.openFile('${f.url}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              Ver
            </button>
          </div>
        </div>
      </div>
    `;
    }).join('');
  }

  function downloadFile(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function openFile(url) {
    window.open(url, '_blank');
  }

  function showContextMenu(event, url, name) {
    event.preventDefault();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <div class="context-menu-item" onclick="MediaGallery.downloadFile('${url}', '${name}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Descargar
      </div>
      <div class="context-menu-item" onclick="MediaGallery.openFile('${url}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        Abrir
      </div>
      <div class="context-menu-item" onclick="MediaGallery.copyFileUrl('${url}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        Copiar URL
      </div>
    `;
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    document.body.appendChild(menu);

    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  function copyFileUrl(url) {
    navigator.clipboard.writeText(window.location.origin + url).then(() => {
      Toast.show('URL copiada al portapapeles', 'success');
    });
  }

  return {
    loadMedia,
    filter,
    setView,
    downloadFile,
    openFile,
    showContextMenu,
    copyFileUrl
  };
})();

window.MediaGallery = MediaGallery;
