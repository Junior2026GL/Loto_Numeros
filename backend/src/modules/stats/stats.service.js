import { AppError } from '../../shared/errors/AppError.js';
import * as draws from '../draws/draws.repository.js';
import * as repository from './stats.repository.js';
import { computeStats } from './stats.calculator.js';

const MAX_LAST = 1000;

export async function getStats(query) {
  const game = await draws.findDefaultGame();
  if (!game) throw new AppError('No hay un juego activo configurado', 500);

  const dias = game.dias_sorteo.split(',').map(Number);
  const ultimos = Number(query.ultimos);
  const dia = query.dia === undefined || query.dia === '' ? null : Number(query.dia);

  const [history, config] = await Promise.all([
    repository.loadDraws({
      juegoId: game.id,
      ultimos: Number.isInteger(ultimos) && ultimos > 0 ? Math.min(ultimos, MAX_LAST) : null,
      dia: Number.isInteger(dia) && dias.includes(dia) ? dia : null,
    }),
    repository.loadConfig(),
  ]);

  const stats = computeStats(history, game, {
    ventanaCalientes: config.ventana_calientes,
    pesos: {
      frecuencia: config.peso_frecuencia,
      atraso: config.peso_atraso,
      caliente: config.peso_caliente,
    },
  });

  return {
    ...stats,
    juego: {
      nombre: game.nombre,
      cantidad_numeros: game.cantidad_numeros,
      numero_min: game.numero_min,
      numero_max: game.numero_max,
      dias_sorteo: dias,
    },
    ventanaCalientes: Number(config.ventana_calientes) || 5,
    desde: history.at(-1)?.fecha || null,
    hasta: history[0]?.fecha || null,
  };
}
