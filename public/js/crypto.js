/* ── Client-side double-layer AES-GCM encryption ────────────── */
'use strict';

const _CryptoLayer = (() => {
  const _enc = new TextEncoder();
  const _dec = new TextDecoder();

  async function _deriveKey(secret, salt) {
    const raw  = await crypto.subtle.importKey('raw', _enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: _enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }

  async function encrypt(plaintext, secret, salt) {
    const key = await _deriveKey(secret, salt);
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, _enc.encode(plaintext));
    const buf = new Uint8Array(iv.byteLength + enc.byteLength);
    buf.set(iv, 0); buf.set(new Uint8Array(enc), iv.byteLength);
    return btoa(String.fromCharCode(...buf));
  }

  async function decrypt(cipherB64, secret, salt) {
    const buf  = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));
    const iv   = buf.slice(0, 12);
    const data = buf.slice(12);
    const key  = await _deriveKey(secret, salt);
    const dec  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return _dec.decode(dec);
  }

  /* Double-layer: encrypt with k1 then k2 */
  async function dblEncrypt(text, k1, k2) {
    const layer1 = await encrypt(text, k1, 'chatapp_layer1');
    return encrypt(layer1, k2, 'chatapp_layer2');
  }

  async function dblDecrypt(cipher, k1, k2) {
    const layer1 = await decrypt(cipher, k2, 'chatapp_layer2');
    return decrypt(layer1, k1, 'chatapp_layer1');
  }

  /* Encode arbitrary JSON payload for transmission */
  async function encodePayload(obj, sessionKey) {
    const json = JSON.stringify(obj);
    return dblEncrypt(json, sessionKey, navigator.userAgent.slice(0,16));
  }

  async function decodePayload(cipher, sessionKey) {
    const json = await dblDecrypt(cipher, sessionKey, navigator.userAgent.slice(0,16));
    return JSON.parse(json);
  }

  /* Generate recovery key JSON */
  async function makeRecoveryFile(code, userEmail) {
    const payload = { v:1, e: userEmail, c: code, ts: Date.now() };
    const enc = await encrypt(JSON.stringify(payload), code, 'recovery_salt_v1');
    /* Light obfuscation: base64 encode again with marker */
    const obf = btoa('RK1:' + enc);
    return { _r: obf, _h: Array.from(_enc.encode(userEmail)).reduce((a,b)=>a^b, 0x5A).toString(16) };
  }

  async function readRecoveryFile(obj) {
    const raw  = atob(obj._r);
    if (!raw.startsWith('RK1:')) throw new Error('Formato inválido');
    const enc = raw.slice(4);
    /* We need the code — stored in inner payload; brute-force 6-digit codes is intentionally slow */
    /* Server validates: we just extract the encrypted code string to send */
    return enc;
  }

  return { encrypt, decrypt, dblEncrypt, dblDecrypt, encodePayload, decodePayload,
           makeRecoveryFile, readRecoveryFile };
})();

window.CryptoLayer = _CryptoLayer;
