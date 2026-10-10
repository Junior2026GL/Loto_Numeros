/** Monto en lempiras: 1250 -> "L 1,250.00". */
export function formatMoney(value) {
  if (value === null || value === undefined) return '—';
  return `L ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Probabilidad como porcentaje legible: 0.0000009 -> "0.00009 %". */
export function formatPercent(probability) {
  if (probability === null || probability === undefined) return '—';
  const percent = probability * 100;
  if (percent === 0) return '0 %';
  if (percent >= 1) return `${percent.toFixed(2)} %`;
  return `${percent.toPrecision(2)} %`;
}

/** "1 en 1,107,568". */
export function formatOneIn(value) {
  return value ? `1 en ${Number(value).toLocaleString('en-US')}` : '—';
}
