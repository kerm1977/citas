/* ── AntiFreeze System ───────────────────────────────────────── */
/* Keeps UI responsive by using rIC, worker ping, and chunk scheduling */
'use strict';

const AntiFreeze = (() => {
  let _worker = null;
  let _heartbeat = null;
  const _callbacks = {};  /* private — avoids TDZ self-reference */
  const _queue = [];
  let _running = false;

  /* Inline Worker for heavy computations */
  const _workerCode = `
    self.onmessage = function(e) {
      const { id, type, payload } = e.data;
      let result;
      try {
        if (type === 'hash') {
          /* Heavy work placeholder — returns ack */
          result = { done: true };
        } else if (type === 'ping') {
          result = 'pong';
        }
        self.postMessage({ id, result });
      } catch(err) {
        self.postMessage({ id, error: err.message });
      }
    };
  `;

  function _initWorker() {
    if (_worker) return;
    const blob = new Blob([_workerCode], { type: 'application/javascript' });
    _worker = new Worker(URL.createObjectURL(blob));
    _worker.onmessage = (e) => {
      const cb = _callbacks[e.data.id];
      if (cb) { cb(e.data.result); delete _callbacks[e.data.id]; }
    };
  }

  /* Ping worker every 10s to ensure it stays alive */
  function _startHeartbeat() {
    _heartbeat = setInterval(() => {
      _worker?.postMessage({ id: '_hb', type: 'ping' });
    }, 10000);
  }

  /* Schedule a task using requestIdleCallback with fallback */
  function schedule(fn, timeout = 500) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout });
    } else {
      setTimeout(fn, 0);
    }
  }

  /* Process an array in chunks to avoid long tasks */
  function processChunked(arr, chunkSize, fn, onDone) {
    let idx = 0;
    function step() {
      const end = Math.min(idx + chunkSize, arr.length);
      for (; idx < end; idx++) fn(arr[idx], idx);
      if (idx < arr.length) {
        schedule(step);
      } else if (onDone) {
        onDone();
      }
    }
    schedule(step);
  }

  /* Debounce helper */
  function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  /* Throttle helper */
  function throttle(fn, delay) {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= delay) { last = now; fn(...args); }
    };
  }

  /* Detect long tasks and warn */
  function observeLongTasks() {
    if (!('PerformanceObserver' in window)) return;
    try {
      const obs = new PerformanceObserver((list) => {
        list.getEntries().forEach(e => {
          if (e.duration > 50) console.warn('[AntiFreeze] Long task:', Math.round(e.duration), 'ms');
        });
      });
      obs.observe({ entryTypes: ['longtask'] });
    } catch { /* not supported */ }
  }

  function init() {
    _initWorker();
    _startHeartbeat();
    observeLongTasks();
    console.log('[AntiFreeze] Active ✅');
  }

  return { init, schedule, processChunked, debounce, throttle };
})();

window.AntiFreeze = AntiFreeze;
