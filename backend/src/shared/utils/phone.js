export function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}