/**
 * Mensaje legible en español para errores de Supabase Auth (signIn / signUp).
 * @param {unknown} error
 * @returns {string}
 */
export function mapSupabaseAuthError(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const msg = (typeof error?.message === 'string' ? error.message : '').toLowerCase();

  const byCode = {
    invalid_credentials: 'Email o contraseña incorrectos.',
    email_not_confirmed: 'Tenés que confirmar el correo antes de ingresar. Revisá tu bandeja de entrada.',
    user_already_exists: 'Ya existe una cuenta con ese email. Probá iniciar sesión.',
    weak_password: 'La contraseña es demasiado débil. Usá al menos 6 caracteres.',
    signup_disabled: 'El registro está deshabilitado en este proyecto.',
    otp_expired: 'El enlace o código expiró. Solicitá uno nuevo.',
  };

  if (code && byCode[code]) return byCode[code];

  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return byCode.email_not_confirmed;
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return byCode.invalid_credentials;
  }
  if (msg.includes('already registered') || msg.includes('user already registered') || msg.includes('already exists')) {
    return byCode.user_already_exists;
  }
  if (msg.includes('password') && (msg.includes('at least') || msg.includes('6'))) {
    return byCode.weak_password;
  }
  if (msg.includes('invalid_grant')) {
    return 'No se pudo iniciar sesión. Revisá el email y la contraseña, o probá de nuevo en unos minutos.';
  }
  if (msg.includes('database error saving new user')) {
    return 'No se pudo crear la cuenta por una configuración pendiente en Supabase (tablas/trigger de alta). Aplicá las migraciones y reintentá.';
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return 'No se pudo completar la operación. Intentá de nuevo.';
}
