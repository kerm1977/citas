/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  CHAT-SOCKET — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ── connect() — NO MODIFICAR ──────────────────────────────────────────── ║
 * ║  Crea el socket con io({ auth: { token } }) y registra TODOS los eventos. ║
 * ║  Si se llama más de una vez, el guard _socket?.connected lo previene.     ║
 * ║  NO agregar nuevos eventos de socket aquí — usar getSocket() en otros     ║
 * ║  módulos para escuchar eventos adicionales de moderación.                 ║
 * ║                                                                           ║
 * ║  ── CALLBACKS SEPARADOS — NO MEZCLAR ──────────────────────────────────── ║
 * ║  onConnect(cb)  → cb() sin parámetros — se llama al establecer conexión   ║
 * ║  onOnline(cb)   → cb({ userId, online }) — usuario conecta/desconecta     ║
 * ║  onMessage(cb)  → cb(msg) — mensaje nuevo recibido                        ║
 * ║  onTyping(cb)   → cb(data) — indicador de escritura                       ║
 * ║  onDelete(cb)   → cb(data) — mensaje eliminado                            ║
 * ║  onRead(cb)     → cb(data) — mensaje leído                                ║
 * ║  Mezclar estos callbacks rompe la recepción de mensajes (BUG CONFIRMADO). ║
 * ║                                                                           ║
 * ║  ── getSocket() — SOLO PARA MODERACIÓN ────────────────────────────────── ║
 * ║  Permite a moderation.js acceder al socket para eventos de revisión.      ║
 * ║  NO usar para emitir eventos de chat normales.                            ║
 * ║                                                                           ║
 * ║  ── EVENTOS REGISTRADOS — NO AGREGAR MÁS AQUÍ ─────────────────────────── ║
 * ║  connect · chat:message · chat:typing · chat:delete · chat:read           ║
 * ║  user:online · disconnect · connect_error                                 ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';

const ChatSocket = (() => {
  let _socket = null;
  let _onMessageCallback = null;
  let _onTypingCallback = null;
  let _onDeleteCallback = null;
  let _onReadCallback = null;
  let _onOnlineCallback = null;
  let _onConnectCallback = null;

  function connect() {
    if (_socket?.connected) return;
    _socket = io({ auth: { token: window._session?.token } });
    _socket.on('connect', () => {
      console.log('[Chat] connected');
      if (_onConnectCallback) _onConnectCallback();
    });
    _socket.on('chat:message', (msg) => {
      if (_onMessageCallback) _onMessageCallback(msg);
    });
    _socket.on('chat:typing', (data) => {
      if (_onTypingCallback) _onTypingCallback(data);
    });
    _socket.on('chat:delete', (data) => {
      if (_onDeleteCallback) _onDeleteCallback(data);
    });
    _socket.on('chat:read', (data) => {
      if (_onReadCallback) _onReadCallback(data);
    });
    _socket.on('user:online', (data) => {
      if (_onOnlineCallback) _onOnlineCallback(data);
    });
    _socket.on('disconnect', () => console.log('[Chat] disconnected'));
    _socket.on('connect_error', (e) => Toast.show('Conexión fallida: ' + e.message, 'error'));
  }

  function disconnect() {
    _socket?.disconnect();
    _socket = null;
  }

  function emit(event, data) {
    _socket?.emit(event, data);
  }

  function onMessage(callback) {
    _onMessageCallback = callback;
  }

  function onTyping(callback) {
    _onTypingCallback = callback;
  }

  function onDelete(callback) {
    _onDeleteCallback = callback;
  }

  function onRead(callback) {
    _onReadCallback = callback;
  }

  function onOnline(callback) {
    _onOnlineCallback = callback;
  }

  function onConnect(callback) {
    _onConnectCallback = callback;
  }

  /* ═════════════════════════════════════════════════════════════════════════════
   *  ⚠️  CRÍTICO — FUNCIÓN GETSOCKET PARA MODERACIÓN — NO MODIFICAR  ⚠️
   * ─────────────────────────────────────────────────────────────────────────────────
   *  Permite que otros módulos (como ModerationSystem) accedan al socket
   *  para enviar eventos personalizados de moderación.
   * ═════════════════════════════════════════════════════════════════════════════ */
  function getSocket() {
    return _socket;
  }

  return {
    connect,
    disconnect,
    emit,
    getSocket,
    onMessage,
    onTyping,
    onDelete,
    onRead,
    onOnline,
    onConnect
  };
})();
