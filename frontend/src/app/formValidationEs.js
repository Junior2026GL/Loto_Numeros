function getSpanishMessage(el) {
  const v = el.validity;

  if (v.valueMissing) {
    if (el.tagName === 'SELECT') return 'Selecciona una opción.';
    if (el.type === 'checkbox') return 'Marca esta casilla para continuar.';
    if (el.type === 'radio') return 'Selecciona una de estas opciones.';
    return 'Completa este campo.';
  }

  if (v.typeMismatch) {
    if (el.type === 'email') return 'Ingresa una dirección de correo electrónico válida.';
    if (el.type === 'url') return 'Ingresa una URL válida.';
    return 'El valor ingresado no tiene el formato esperado.';
  }

  if (v.patternMismatch) return el.title || 'El formato ingresado no es válido.';
  if (v.tooShort) return `Debe tener al menos ${el.minLength} caracteres (tiene ${el.value.length}).`;
  if (v.tooLong) return `Debe tener como máximo ${el.maxLength} caracteres.`;
  if (v.rangeUnderflow) return `El valor debe ser mayor o igual a ${el.min}.`;
  if (v.rangeOverflow) return `El valor debe ser menor o igual a ${el.max}.`;
  if (v.stepMismatch) return 'El valor no es válido para este campo.';
  if (v.badInput) return 'El valor ingresado no es válido.';

  return 'Este campo no es válido.';
}

function handleInvalid(e) {
  const el = e.target;
  if (!el || !('validity' in el) || typeof el.setCustomValidity !== 'function') return;

  el.setCustomValidity('');
  if (el.validity.valid) return;
  el.setCustomValidity(getSpanishMessage(el));
}

function clearCustomValidity(e) {
  const el = e.target;
  if (!el || typeof el.setCustomValidity !== 'function') return;
  el.setCustomValidity('');
}

// Traduce al español los mensajes nativos del navegador ("Please fill out
// this field.", etc.) que aparecen en los globos de validación de los
// formularios (atributos required, type="email", pattern, min/max...).
export function setupSpanishFormValidationMessages() {
  document.addEventListener('invalid', handleInvalid, true);
  document.addEventListener('input', clearCustomValidity, true);
  document.addEventListener('change', clearCustomValidity, true);
}
