/* ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️⚠️⚠️  AUTH MIDDLEWARE — BLINDADO — NO MODIFICAR  ⚠️⚠️⚠️               ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  ── DOBLE SECRETO JWT — NO ELIMINAR NINGÚN try/catch ──────────────────── ║
 * ║  SECRET   = JWT_SECRET del .env (secreto activo)                          ║
 * ║  FALLBACK = 'fallback_secret_change_in_production' (compatibilidad)       ║
 * ║                                                                           ║
 * ║  Se prueban AMBOS porque al reiniciar el servidor con un nuevo .env,      ║
 * ║  los tokens de sesiones activas siguen firmados con el secreto anterior.  ║
 * ║  Eliminar el segundo try/catch desconectará a todos los usuarios activos. ║
 * ║                                                                           ║
 * ║  ── authRequired — FLUJO EXACTO — NO ALTERAR ──────────────────────────── ║
 * ║  1. Extrae token del header Authorization: Bearer <token>                 ║
 * ║  2. Intenta verificar con SECRET → si ok, llama next()                   ║
 * ║  3. Si falla, intenta verificar con FALLBACK → si ok, llama next()       ║
 * ║  4. Si ambos fallan → 401 { ok: false, msg: 'Token inválido o expirado' }║
 * ║                                                                           ║
 * ║  ── signToken — NO CAMBIAR OPCIONES ───────────────────────────────────── ║
 * ║  Usa siempre SECRET (del .env). expiresIn = JWT_EXPIRES || '7d'.         ║
 * ║  El payload contiene: { id, email, role } — NO agregar is_approved aquí. ║
 * ║  is_approved es consultado dinámicamente desde la BD en cada request.     ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝ */
'use strict';
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'fallback_secret_change_in_production';

/* ⚠️ CRÍTICO — NO MODIFICAR — DOBLE SECRETO JWT
 * Acepta tokens firmados con JWT_SECRET (.env) Y con el fallback.
 * Necesario para compatibilidad con sesiones existentes tras reinicios.
 * Eliminar cualquiera de los dos try/catch romperá sesiones activas. */
const FALLBACK_SECRET = 'fallback_secret_change_in_production';

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, msg: 'Token requerido' });
  try {
    req.user = jwt.verify(token, SECRET);
    return next();
  } catch {
    try {
      req.user = jwt.verify(token, FALLBACK_SECRET);
      return next();
    } catch {
      return res.status(401).json({ ok: false, msg: 'Token inválido o expirado' });
    }
  }
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    const role = req.user?.role;
    if (role === 'admin' || role === 'superadmin') return next();
    return res.status(403).json({ ok: false, msg: 'Acceso denegado' });
  });
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
}

module.exports = { authRequired, adminRequired, signToken };
