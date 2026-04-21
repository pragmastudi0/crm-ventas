/**
 * Dedupe helpers for Contacto: phone (whatsapp / numeroTelefono) and nombre+apellido.
 * All comparisons are scoped to the same workspace via the caller's `existingContacts` list.
 */

/** Digits only for phone equality (handles +, spaces, dashes). */
export function normalizePhoneDigits(value) {
  if (value == null || value === "") return "";
  return String(value).replace(/\D/g, "");
}

/** Name part: trim, lowercase, strip combining marks for stable match. */
export function normalizeNamePart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** True if both nombre and apellido are non-empty after normalization. */
export function hasFullName(nombre, apellido) {
  return Boolean(normalizeNamePart(nombre)) && Boolean(normalizeNamePart(apellido));
}

function contactPhonesNormalized(contact) {
  const w = normalizePhoneDigits(contact?.whatsapp);
  const n = normalizePhoneDigits(contact?.numeroTelefono);
  const set = new Set();
  if (w) set.add(w);
  if (n && n !== w) set.add(n);
  return set;
}

/**
 * @param {string} phoneDigits
 * @returns {boolean}
 */
export function isMeaningfulPhoneDigits(phoneDigits) {
  return phoneDigits.length >= 8;
}

/**
 * Contacts whose whatsapp or numeroTelefono matches the given digits (exact on normalized string).
 * @param {Array<object>} existingContacts
 * @param {string} rawPhone
 * @param {string} [excludeContactId]
 */
export function findContactsWithSamePhone(existingContacts, rawPhone, excludeContactId) {
  const digits = normalizePhoneDigits(rawPhone);
  if (!isMeaningfulPhoneDigits(digits)) return [];
  return (existingContacts || []).filter((c) => {
    if (excludeContactId && c.id === excludeContactId) return false;
    for (const p of contactPhonesNormalized(c)) {
      if (p === digits) return true;
    }
    return false;
  });
}

/**
 * Same nombre+apellido (both sides must have non-empty apellido on the *incoming* payload;
 * existing row matches if both name parts normalize equal).
 * @param {Array<object>} existingContacts
 * @param {string} nombre
 * @param {string} apellido
 * @param {string} [excludeContactId]
 */
export function findContactsWithSameFullName(existingContacts, nombre, apellido, excludeContactId) {
  if (!hasFullName(nombre, apellido)) return [];
  const n = normalizeNamePart(nombre);
  const a = normalizeNamePart(apellido);
  return (existingContacts || []).filter((c) => {
    if (excludeContactId && c.id === excludeContactId) return false;
    if (!hasFullName(c.nombre, c.apellido)) return false;
    return normalizeNamePart(c.nombre) === n && normalizeNamePart(c.apellido) === a;
  });
}

/**
 * Validate before create/update (client-side).
 * @param {object} opts
 * @param {Array<object>} opts.existingContacts
 * @param {string} opts.nombre
 * @param {string} [opts.apellido]
 * @param {string} [opts.whatsapp]
 * @param {string} [opts.numeroTelefono]
 * @param {string} [opts.excludeContactId] When editing, skip this contact id.
 * @returns {{ ok: true } | { ok: false, reason: 'phone' | 'fullName', matches: Array<object>, message: string }}
 */
export function validateContactNoDuplicates({
  existingContacts,
  nombre,
  apellido,
  whatsapp,
  numeroTelefono,
  excludeContactId = undefined,
}) {
  const phoneRaw = whatsapp || numeroTelefono || "";
  const phoneMatches = findContactsWithSamePhone(existingContacts, phoneRaw, excludeContactId);
  if (phoneMatches.length > 0) {
    return {
      ok: false,
      reason: "phone",
      matches: phoneMatches,
      message:
        "Ya existe un contacto con este número de teléfono. Usá el contacto existente o cambiá el número.",
    };
  }
  const nameMatches = findContactsWithSameFullName(existingContacts, nombre, apellido, excludeContactId);
  if (nameMatches.length > 0) {
    return {
      ok: false,
      reason: "fullName",
      matches: nameMatches,
      message:
        "Ya existe un contacto con el mismo nombre y apellido. Usá el contacto existente o ajustá los datos.",
    };
  }
  return { ok: true };
}

/**
 * @throws {Error} with user-oriented message
 */
export function assertContactNoDuplicates(params) {
  const result = validateContactNoDuplicates(params);
  if (!result.ok) throw new Error(result.message);
}
