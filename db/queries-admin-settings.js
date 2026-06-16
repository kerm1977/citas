'use strict';
const { dbGet, dbAll, dbRun } = require('./db-core');

function getSetting(key) {
  const row = dbGet('SELECT value FROM admin_settings WHERE key=?', [key]);
  return row ? row.value : null;
}

function setSetting(key, value) {
  dbRun(`INSERT INTO admin_settings (key, value) VALUES (?,?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [key, value]);
}

function initDefaultSettings() {
  const defaultRegisterMessage = `🌸 Bienvenidas a Zona Segura

Esta aplicación es únicamente para Mujeres sin importar su orientación Sexual.

La aplicación no guarda registros, no solicita información personal y mucho menos información financiera.

🔍 Verificación:

    Se solicitarán pruebas por mujeres para verificar que son mujeres.
    No se permiten "micrófonos malos, cámaras malas".
    Solo ingresan las autorizadas por las mujeres moderadoras.

👨‍💻 Desarrollo: El único hombre con acceso es del grupo de desarrolladores, sin acceso a datos encriptados.

🔒 Privacidad: Información totalmente encriptada. Imágenes van de persona a persona.

⚠️ Responsabilidad: Si estás aquí lo haces por tu propia voluntad.

🛡️ Moderación: Las mujeres en el chat denuncian anomalías y material ofensivo.

💝 Donaciones: Solicitamos donaciones a partir de $2 USD o ₡1000, pero no por el momento.`;

  if (!getSetting('register_message')) {
    setSetting('register_message', defaultRegisterMessage);
  }
}

module.exports = { getSetting, setSetting, initDefaultSettings };
