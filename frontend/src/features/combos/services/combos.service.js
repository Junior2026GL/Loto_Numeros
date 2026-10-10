import { api } from '../../../services/api.js';

export async function generateCombinations() {
  const { data } = await api.post('/combinaciones/generar');
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

export async function setCombinationPlayed(id, jugada) {
  const { data } = await api.patch(`/combinaciones/${id}/jugada`, { jugada });
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
