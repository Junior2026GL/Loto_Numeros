import { api } from '../../../services/api.js';

export async function listAudit(params) {
  const { data } = await api.get('/auditoria', { params });
  return data.data;
}

export async function getAuditStats(params) {
  const { data } = await api.get('/auditoria/resumen', { params });
  return data.data;
}
