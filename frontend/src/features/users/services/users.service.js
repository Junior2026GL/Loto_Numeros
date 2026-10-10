import { api } from '../../../services/api.js';

export async function listUsers() {
  const { data } = await api.get('/users');
  return data.data;
}

export async function listRoles() {
  const { data } = await api.get('/users/roles');
  return data.data;
}

export async function createUser(payload) {
  const { data } = await api.post('/users', payload);
  return data.data;
}

export async function updateUser(id, payload) {
  const { data } = await api.put(`/users/${id}`, payload);
  return data.data;
}

export async function setUserStatus(id, activo) {
  const { data } = await api.patch(`/users/${id}/estado`, { activo });
  return data.data;
}

export async function resetUserPassword(id, password) {
  const { data } = await api.patch(`/users/${id}/password`, { password });
  return data.data;
}
