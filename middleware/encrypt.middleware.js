'use strict';
const crypto = require('crypto');

const KEY_HEX = process.env.ENCRYPT_KEY  || 'defaultkeychangeme!!defaultkeych';
const KEY      = Buffer.from(KEY_HEX.padEnd(32).slice(0,32));

/* AES-256-GCM encrypt → { iv, tag, data } all hex */
function encrypt(text) {
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc  = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return {
    iv:   iv.toString('hex'),
    tag:  cipher.getAuthTag().toString('hex'),
    data: enc.toString('hex')
  };
}

/* AES-256-GCM decrypt */
function decrypt(obj) {
  const iv     = Buffer.from(obj.iv,  'hex');
  const tag    = Buffer.from(obj.tag, 'hex');
  const enc    = Buffer.from(obj.data,'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/* Middleware — encrypts outgoing JSON responses */
function encryptResponse(req, res, next) {
  const _json = res.json.bind(res);
  res.json = (body) => {
    if (process.env.NODE_ENV === 'production') {
      const enc = encrypt(JSON.stringify(body));
      return _json({ _e: enc });
    }
    return _json(body);
  };
  next();
}

/* Decrypt incoming body if encrypted */
function decryptBody(req, res, next) {
  if (req.body && req.body._e) {
    try {
      req.body = JSON.parse(decrypt(req.body._e));
    } catch {
      return res.status(400).json({ ok: false, msg: 'Payload inválido' });
    }
  }
  next();
}

module.exports = { encrypt, decrypt, encryptResponse, decryptBody };
