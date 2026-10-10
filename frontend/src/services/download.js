import { api } from './api.js';

/** Descarga un archivo desde la API (necesita el token, por eso no basta con un enlace normal). */
export async function downloadFile(path, filename, params) {
  const response = await api.get(path, { params, responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
