import { api } from '../../../services/api.js';

export async function getGame() {
  const { data } = await api.get('/sorteos/juego');
  return data.data;
}

export async function getSummary() {
  const { data } = await api.get('/sorteos/resumen');
  return data.data;
}

export async function listMonths() {
  const { data } = await api.get('/sorteos/meses');
  return data.data;
}

export async function listDraws(params) {
  const { data } = await api.get('/sorteos', { params });
  return data.data;
}

export async function createDraw(payload) {
  const { data } = await api.post('/sorteos', payload);
  return data.data;
}

export async function deleteDraw(id) {
  const { data } = await api.delete(`/sorteos/${id}`);
  return data.data;
}
