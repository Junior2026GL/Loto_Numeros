import { api } from '../../../services/api.js';

export async function getSyncStatus() {
  const { data } = await api.get('/sincronizacion/estado');
  return data.data;
}

export async function listSyncRuns(params) {
  const { data } = await api.get('/sincronizacion/historial', { params });
  return data.data;
}

export async function runSync(payload) {
  // La consulta puede tardar: hay una petición por cada sorteo pendiente.
  const { data } = await api.post('/sincronizacion', payload, { timeout: 180000 });
  return data.data;
}
