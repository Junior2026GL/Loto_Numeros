import { api } from '../../../services/api.js';

export async function getSettings() {
  const { data } = await api.get('/configuracion');
  return data.data;
}

export async function saveSettings(payload) {
  const { data } = await api.put('/configuracion', payload);
  return data.data;
}
