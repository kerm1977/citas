/* ── Eye Button Toggle (Standalone - No Dependencies) ───────────── */
'use strict';

(function() {
  function toggleEye(btn) {
    const target = document.getElementById(btn.dataset.target);
    if (!target) {
      console.error('[EyeButton] Target not found:', btn.dataset.target);
      return;
    }
    target.type = target.type === 'password' ? 'text' : 'password';
    const svg = target.type === 'password' 
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    btn.innerHTML = svg;
    console.log('[EyeButton] Toggled:', btn.dataset.target, '->', target.type);
  }

  function bindButtons() {
    document.querySelectorAll('.eye-btn').forEach(btn => {
      btn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleEye(btn);
      };
    });
    console.log('[EyeButton] Bound', document.querySelectorAll('.eye-btn').length, 'buttons');
  }

  /* Bind on DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButtons);
  } else {
    bindButtons();
  }

  /* Capture phase - runs before any other handlers */
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.eye-btn');
    if (btn) {
      e.stopPropagation();
      e.preventDefault();
      toggleEye(btn);
    }
  }, true);

  /* Also bind dynamically added buttons via MutationObserver */
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) {
          const buttons = node.querySelectorAll ? node.querySelectorAll('.eye-btn') : [];
          if (buttons.length > 0) {
            buttons.forEach(btn => {
              btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleEye(btn);
              };
            });
            console.log('[EyeButton] Bound', buttons.length, 'new buttons');
          }
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[EyeButton] Initialized');
})();
