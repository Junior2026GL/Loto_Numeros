import * as service from './settings.service.js';
import { record as recordAudit } from '../audit/audit.service.js';

export async function get(req, res, next) {
  try {
    res.json({ ok: true, data: await service.get() });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const data = await service.update(req.body);
    await recordAudit(req, {
      accion: 'ACTUALIZAR',
      modulo: 'CONFIGURACION',
      descripcion: `Configuración de estadísticas: ventana ${data.ventanaCalientes}, pesos ${data.pesos.frecuencia}/${data.pesos.atraso}/${data.pesos.caliente}`,
    });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}
