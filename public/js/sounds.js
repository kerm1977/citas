/* ── Sound Effects Module (HTML Audio Elements with Data URIs) ───── */
'use strict';

const SoundEffects = (() => {
  /* Generate simple beep sounds using Web Audio API and convert to base64 */
  function _generateBeep(frequency, duration, type = 'sine') {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 10); /* Decay envelope */
      if (type === 'sine') {
        buffer[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
      } else if (type === 'square') {
        buffer[i] = (Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1) * envelope * 0.2;
      }
    }
    
    return _floatToWav(buffer);
  }

  function _floatToWav(buffer) {
    const numChannels = 1;
    const sampleRate = 44100;
    const bitsPerSample = 16;
    const blockAlign = numChannels * bitsPerSample / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const buffer16 = new Int16Array(buffer.length);
    
    for (let i = 0; i < buffer.length; i++) {
      buffer16[i] = Math.max(-32768, Math.min(32767, buffer[i] * 32768));
    }
    
    const wav = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wav);
    
    /* WAV header */
    _writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    _writeString(view, 8, 'WAVE');
    _writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    _writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    for (let i = 0; i < buffer16.length; i++) {
      view.setInt16(44 + i * 2, buffer16[i], true);
    }
    
    const blob = new Blob([wav], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  function _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function init() {
    /* Initialize audio elements with generated sounds */
    const sendSound = document.getElementById('sound-send');
    const receiveSound = document.getElementById('sound-receive');
    const connectSound = document.getElementById('sound-connect');
    const disconnectSound = document.getElementById('sound-disconnect');
    
    if (sendSound && !sendSound.src) {
      /* Send: High ping */
      sendSound.src = _generateBeep(800, 0.1);
    }
    
    if (receiveSound && !receiveSound.src) {
      /* Receive: Pleasant chime (C5, E5, G5) */
      receiveSound.src = _generateBeep(523.25, 0.3);
    }
    
    if (connectSound && !connectSound.src) {
      /* Connect: Rising tone */
      connectSound.src = _generateBeep(600, 0.2);
    }
    
    if (disconnectSound && !disconnectSound.src) {
      /* Disconnect: Falling tone */
      disconnectSound.src = _generateBeep(400, 0.2);
    }
  }

  function playSend() {
    const el = document.getElementById('sound-send');
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  }

  function playReceive() {
    const el = document.getElementById('sound-receive');
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  }

  function playConnect() {
    const el = document.getElementById('sound-connect');
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  }

  function playDisconnect() {
    const el = document.getElementById('sound-disconnect');
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  }

  return { init, playSend, playReceive, playConnect, playDisconnect };
})();

window.SoundEffects = SoundEffects;
