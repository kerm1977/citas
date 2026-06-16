/* ═════════════════════════════════════════════════════════════════════════════
 *  ⚠️⚠️⚠️ MÓDULO DE SOCKET — CÓDIGO VALIDADO Y FUNCIONANDO — NO MODIFICAR ⚠️⚠️⚠️
 * ─────────────────────────────────────────────────────────────────────────────────
 *  Este módulo maneja la conexión Socket.IO y los eventos del chat.
 *
 *  REGLAS DE PRESERVACIÓN:
 *  1. Los callbacks están separados: onConnect (sin parámetros) y onOnline (con parámetros)
 *  2. NO mezclar estos callbacks o causará errores en la recepción de mensajes
 *  3. La estructura de eventos está validada y funcionando correctamente
 *  4. Solo se permiten integraciones, NO cambios a la lógica existente
 * ═════════════════════════════════════════════════════════════════════════════ */
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
