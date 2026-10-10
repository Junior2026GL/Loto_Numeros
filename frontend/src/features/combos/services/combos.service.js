import { api } from '../../../services/api.js';

/** @param options { fijos, excluidos, equilibrada, cantidad } */
export async function generateCombinations(options = {}) {
  const { data } = await api.post('/combinaciones/generar', options);
  return data.data;
}

export async function saveCombination(payload) {
  const { data } = await api.post('/combinaciones', payload);
  return data.data;
}

export async function listCombinations(params) {
  const { data } = await api.get('/combinaciones', { params });
  return data.data;
}

export async function getCombinationsSummary() {
  const { data } = await api.get('/combinaciones/resumen');
  return data.data;
}

/** @param modalidad 'SENCILLA' o 'DOBLE' (solo importa cuando jugada es true) */
export async function setCombinationPlayed(id, jugada, confirmar = false, modalidad = 'SENCILLA') {
  const { data } = await api.patch(`/combinaciones/${id}/jugada`, { jugada, confirmar, modalidad });
  return data.data;
}

export async function setCombinationPrize(id, premio) {
  const { data } = await api.patch(`/combinaciones/${id}/premio`, { premio });
  return data.data;
}

export async function deleteCombination(id) {
  const { data } = await api.delete(`/combinaciones/${id}`);
  return data.data;
}

export async function getRetrospective() {
  const { data } = await api.get('/combinaciones/prueba-retrospectiva');
  return data.data;
}

export async function getOdds() {
  const { data } = await api.get('/combinaciones/probabilidades');
  return data.data;
}

export async function buildWheel(payload) {
  const { data } = await api.post('/combinaciones/cobertura', payload);
  return data.data;
}

export async function simulateCombination(payload) {
  const { data } = await api.post('/combinaciones/simular', payload);
  return data.data;
}

export async function getBudget() {
  const { data } = await api.get('/combinaciones/presupuesto');
  return data.data;
}

export async function saveMonthlyLimit(limiteMensual) {
  const { data } = await api.put('/combinaciones/presupuesto', { limiteMensual });
  return data.data;
}
