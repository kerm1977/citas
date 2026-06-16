/* ── Form Validation — all rules isolated here ───────────────── */
'use strict';

const Validate = (() => {
  /* Country codes for Central America */
  const COUNTRIES = [
    { code: '+506', label: '🇨🇷 +506 Costa Rica', regex: /^\d{8}$/ },
    { code: '+505', label: '🇳🇮 +505 Nicaragua',  regex: /^\d{8}$/ },
    { code: '+503', label: '🇸🇻 +503 El Salvador', regex: /^\d{8}$/ },
    { code: '+504', label: '🇭🇳 +504 Honduras',    regex: /^\d{8}$/ },
    { code: '+502', label: '🇬🇹 +502 Guatemala',   regex: /^\d{8}$/ },
    { code: '+507', label: '🇵🇦 +507 Panamá',      regex: /^\d{7,8}$/ }
  ];

  /* Name: letters only, Title Case, single space between words */
  function name(val) {
    if (!val || !val.trim()) return 'El nombre es requerido';
    if (!/^[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+( [A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+)*$/.test(val.trim()))
      return 'Solo letras, una sola mayúscula por palabra, sin números ni caracteres especiales';
    const words = val.trim().split(' ');
    for (const w of words)
      if (w[0] !== w[0].toUpperCase()) return 'Cada palabra debe iniciar con mayúscula';
    return '';
  }

  /* Email */
  function email(val) {
    if (!val || !val.trim()) return 'El correo es requerido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return 'Correo inválido';
    return '';
  }

  /* Phone: only digits matching country pattern */
  function phone(number, countryCode) {
    if (!number || !number.trim()) return 'El teléfono es requerido';
    if (!/^\d+$/.test(number.trim())) return 'Solo se permiten números';
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (!country) return 'Selecciona un país';
    if (!country.regex.test(number.trim())) return `Número inválido para ${countryCode}`;
    return '';
  }

  /* Password strength */
  function password(val) {
    if (!val) return 'La contraseña es requerida';
    if (val.length < 8) return 'Mínimo 8 caracteres';
    return '';
  }

  /* Password confirmation */
  function passwordMatch(val, val2) {
    if (val !== val2) return 'Las contraseñas no coinciden';
    return '';
  }

  /* Show/clear inline error */
  function setError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
  }

  function clearErrors(...ids) {
    ids.forEach(id => setError(id, ''));
  }

  /* Validate full register form; returns true if valid */
  function register(fields) {
    const errs = {
      name:  name(fields.name),
      email: email(fields.email),
      phone: phone(fields.phone, fields.countryCode),
      pass:  password(fields.password),
      pass2: passwordMatch(fields.password, fields.password2)
    };
    setError('r-name-err',  errs.name);
    setError('r-email-err', errs.email);
    setError('r-phone-err', errs.phone);
    setError('r-pass-err',  errs.pass);
    setError('r-pass2-err', errs.pass2);
    return !Object.values(errs).some(Boolean);
  }

  /* Validate login form; returns true if valid */
  function login(fields) {
    const errs = {
      email: email(fields.email),
      pass:  fields.password ? '' : 'La contraseña es requerida'
    };
    setError('l-email-err', errs.email);
    setError('l-pass-err',  errs.pass);
    return !Object.values(errs).some(Boolean);
  }

  /* Populate country <select> */
  function populateCountries(selectId, defaultCode = '+506') {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = COUNTRIES.map(c =>
      `<option value="${c.code}"${c.code === defaultCode ? ' selected' : ''}>${c.label}</option>`
    ).join('');
  }

  return { name, email, phone, password, passwordMatch,
           register, login, setError, clearErrors, populateCountries, COUNTRIES };
})();

window.Validate = Validate;
