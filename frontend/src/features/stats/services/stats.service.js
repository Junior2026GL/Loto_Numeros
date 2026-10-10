import { api } from '../../../services/api.js';

export async function getStats(params) {
  const { data } = await api.get('/estadisticas', { params });
  return data.data;
}
