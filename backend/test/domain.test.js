import './env.js';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, insertUser, startApi } from './helpers.js';
import { db } from '../src/infrastructure/database/mysql.js';

let conn;
let api;
let tokens;

before(async () => {
  conn = await createTestDatabase();
  api = await startApi();
  await insertUser(conn, { usuario: 'admin.prueba', rol: 'ADMIN' });
  await insertUser(conn, { usuario: 'normal.prueba', rol: 'NORMAL' });
  tokens = {
    SUPER_ADMIN: (await api.login('superadmin')).token,
    ADMIN: (await api.login('admin.prueba')).token,
    NORMAL: (await api.login('normal.prueba')).token,
    SIN_TOKEN: undefined,
  };
});

after(async () => {
  globalThis.fetch = realFetch;
  await api.close();
  await db.end();
  await conn.end();
});

const realFetch = globalThis.fetch;

test('permisos por rol en cada endpoint', async () => {
  // [método, ruta, cuerpo, estado esperado por rol]
  const badDraw = { fecha: '2026-10-07', numeros: [1] }; // inválido a propósito: solo importa si pasa el permiso
  const matrix = [
    ['GET', '/sorteos/resumen', undefined, { SUPER_ADMIN: 200, ADMIN: 200, NORMAL: 200, SIN_TOKEN: 401 }],
    ['GET', '/sorteos', undefined, { SUPER_ADMIN: 200, ADMIN: 200, NORMAL: 200, SIN_TOKEN: 401 }],
    ['POST', '/sorteos', badDraw, { SUPER_ADMIN: 400, ADMIN: 400, NORMAL: 403, SIN_TOKEN: 401 }],
    ['GET', '/estadisticas', undefined, { SUPER_ADMIN: 200, ADMIN: 200, NORMAL: 200, SIN_TOKEN: 401 }],
    ['POST', '/combinaciones/generar', undefined, { SUPER_ADMIN: 200, ADMIN: 200, NORMAL: 200, SIN_TOKEN: 401 }],
    ['GET', '/combinaciones', undefined, { SUPER_ADMIN: 200, ADMIN: 200, NORMAL: 200, SIN_TOKEN: 401 }],
    ['GET', '/sincronizacion/estado', undefined, { SUPER_ADMIN: 200, ADMIN: 200, NORMAL: 403, SIN_TOKEN: 401 }],
    ['GET', '/sincronizacion/historial', undefined, { SUPER_ADMIN: 200, ADMIN: 200, NORMAL: 403, SIN_TOKEN: 401 }],
    ['GET', '/users', undefined, { SUPER_ADMIN: 200, ADMIN: 403, NORMAL: 403, SIN_TOKEN: 401 }],
    ['GET', '/auditoria', undefined, { SUPER_ADMIN: 200, ADMIN: 403, NORMAL: 403, SIN_TOKEN: 401 }],
    ['GET', '/auth/me', undefined, { SUPER_ADMIN: 200, ADMIN: 200, NORMAL: 200, SIN_TOKEN: 401 }],
  ];

  for (const [method, path, body, expected] of matrix) {
    for (const [role, status] of Object.entries(expected)) {
      const res = await api.request(method, path, { token: tokens[role], body });
      assert.equal(res.status, status, `${method} ${path} como ${role}`);
    }
  }
});

test('sorteos: valida los datos y permite registrar y eliminar', async () => {
  const post = (body) => api.request('POST', '/sorteos', { token: tokens.ADMIN, body });
  const ok = [1, 2, 3, 4, 5, 6];

  const cases = [
    [{ fecha: '2026-07-17', numeros: ok }, /día de sorteo/],
    [{ fecha: '2026-07-18', numeros: [1, 2, 3, 4, 5] }, /exactamente 6/],
    [{ fecha: '2026-07-18', numeros: [1, 2, 3, 4, 5, 40] }, /entre 1 y 33/],
    [{ fecha: '2026-07-18', numeros: [1, 2, 3, 4, 5, 5] }, /repetirse/],
    [{ fecha: '2030-01-02', numeros: ok }, /futura/],
    [{ fecha: '2026-02-30', numeros: ok }, /no es válida/],
    [{ fecha: '2026-07-15', numeros: ok }, /Ya existe/],
  ];
  for (const [body, message] of cases) {
    const res = await post(body);
    assert.ok(res.status === 400 || res.status === 409, `estado ${res.status} para ${JSON.stringify(body)}`);
    assert.match(res.message, message);
  }

  const created = await post({ fecha: '2026-07-18', numeros: [33, 2, 17, 9, 25, 11] });
  assert.equal(created.status, 201);
  assert.deepEqual(created.data.numeros, [2, 9, 11, 17, 25, 33]);

  const removed = await api.request('DELETE', `/sorteos/${created.data.id}`, { token: tokens.ADMIN });
  assert.equal(removed.status, 200);
  assert.equal((await api.request('GET', `/sorteos/${created.data.id}`, { token: tokens.ADMIN })).status, 404);
});

test('sorteos: el historial se filtra por mes y por día', async () => {
  const may = await api.request('GET', '/sorteos?anio=2026&mes=5&pageSize=50', { token: tokens.NORMAL });
  assert.equal(may.data.total, 9);
  const saturdays = await api.request('GET', '/sorteos?anio=2026&mes=5&dia=6&pageSize=50', { token: tokens.NORMAL });
  assert.equal(saturdays.data.total, 5);
  assert.ok(saturdays.data.items.every((d) => d.dia_semana === 6));
  assert.ok(saturdays.data.items.every((d) => d.numeros.length === 6));
});

test('sincronización: guarda lo nuevo, no duplica y respeta los permisos', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const text = String(url);
    if (!text.includes('loto.hn')) return realFetch(url, options);
    calls.push(text);
    const body = text.includes('fecha=2026-07-18')
      ? { par1: '5', par2: '11', par3: '15', par4: '22', par5: '27', par6: '29' }
      : []; // los demás días no tienen resultado
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const run = () => api.request('POST', '/sincronizacion', {
    token: tokens.ADMIN,
    body: { desde: '2026-07-16', hasta: '2026-07-22' },
  });

  const first = await run();
  assert.equal(first.status, 200);
  assert.equal(first.data.insertados, 1);
  assert.equal(first.data.errores, 0);
  assert.deepEqual(calls.map((c) => c.slice(-10)), ['2026-07-18', '2026-07-22']);

  const second = await run();
  assert.equal(second.data.insertados, 0);
  assert.equal(calls.length, 3, 'la segunda vez solo vuelve a consultar el día que no tenía resultado');

  const saved = await api.request('GET', '/sorteos?mes=7&dia=6', { token: tokens.NORMAL });
  assert.deepEqual(saved.data.items[0].numeros, [5, 11, 15, 22, 27, 29]);
  assert.equal(saved.data.items[0].fuente, 'SCRAPER');

  assert.equal((await api.request('POST', '/sincronizacion', { token: tokens.NORMAL, body: { desde: '2026-07-16', hasta: '2026-07-22' } })).status, 403);

  const bad = await api.request('POST', '/sincronizacion', { token: tokens.ADMIN, body: { desde: '2026-10-01', hasta: '2026-09-01' } });
  assert.equal(bad.status, 400);
});

test('sincronización: rechaza datos inválidos de la fuente y se detiene si la fuente cae', async () => {
  await conn.query("DELETE FROM sorteos WHERE fecha >= '2026-07-16'");

  globalThis.fetch = async (url, options) => {
    if (!String(url).includes('loto.hn')) return realFetch(url, options);
    // Números repetidos: la fuente devuelve basura y no debe guardarse.
    return new Response(JSON.stringify({ par1: '5', par2: '5', par3: '15', par4: '22', par5: '27', par6: '29' }), { status: 200 });
  };
  const garbage = await api.request('POST', '/sincronizacion', { token: tokens.ADMIN, body: { desde: '2026-07-18', hasta: '2026-07-18' } });
  assert.equal(garbage.data.insertados, 0);
  assert.equal(garbage.data.errores, 1);
  assert.match(garbage.data.detalle[0], /repetidos/);

  globalThis.fetch = async (url, options) => {
    if (!String(url).includes('loto.hn')) return realFetch(url, options);
    return new Response('error', { status: 500 });
  };
  const down = await api.request('POST', '/sincronizacion', { token: tokens.ADMIN, body: { desde: '2026-07-16', hasta: '2026-09-30' } });
  assert.equal(down.data.estado, 'FALLIDA');
  assert.match(down.data.detalle.join(' '), /la fuente no responde/);
  globalThis.fetch = realFetch;

  // El estado expone la falla y cuántos sorteos faltan, para avisar en el dashboard.
  const status = await api.request('GET', '/sincronizacion/estado', { token: tokens.ADMIN });
  assert.equal(status.data.ultimaEjecucion.estado, 'FALLIDA');
  assert.ok(status.data.pendientes > 0);
  const summary = await api.request('GET', '/sorteos/resumen', { token: tokens.NORMAL });
  assert.equal(summary.data.pendientes, status.data.pendientes);
});

test('estadísticas: devuelve el análisis completo y respeta los filtros', async () => {
  const all = await api.request('GET', '/estadisticas', { token: tokens.NORMAL });
  assert.equal(all.status, 200);
  assert.equal(all.data.totalSorteos, 22);
  assert.equal(all.data.frecuencia.length, 33);
  assert.equal(all.data.mejorCombinacion.length, 6);
  assert.equal(all.data.frecuencia.reduce((acc, f) => acc + f.veces, 0), 22 * 6);

  const last5 = await api.request('GET', '/estadisticas?ultimos=5', { token: tokens.NORMAL });
  assert.equal(last5.data.totalSorteos, 5);

  const wednesdays = await api.request('GET', '/estadisticas?dia=3', { token: tokens.NORMAL });
  assert.equal(wednesdays.data.totalSorteos, 11);
});

test('combinaciones: genera, guarda, valida, evalúa los aciertos y son privadas de cada usuario', async () => {
  const generated = await api.request('POST', '/combinaciones/generar', { token: tokens.NORMAL });
  assert.equal(generated.data.estrategias.length, 7);
  for (const s of generated.data.estrategias) {
    assert.equal(new Set(s.numeros).size, 6);
    assert.ok(s.numeros.every((n) => n >= 1 && n <= 33));
  }

  const save = (body, role = 'NORMAL') => api.request('POST', '/combinaciones', { token: tokens[role], body });
  assert.equal((await save({ estrategia: 'MAGIA', numeros: [1, 2, 3, 4, 5, 6] })).status, 400);
  assert.equal((await save({ estrategia: 'AZAR', numeros: [1, 2, 3, 4, 5] })).status, 400);
  assert.equal((await save({ estrategia: 'AZAR', numeros: [1, 2, 3, 4, 5, 5] })).status, 400);
  assert.match((await save({ estrategia: 'AZAR', numeros: [1, 2, 3, 4, 5, 6], fecha: '2026-07-15' })).message, /ya pasó|resultado/);

  const mine = await save({ estrategia: 'SCORE', numeros: generated.data.estrategias[0].numeros });
  assert.equal(mine.status, 201);
  assert.equal(mine.data.aciertos, null);
  assert.equal(mine.data.fecha_sorteo_objetivo, generated.data.proximoSorteo.fecha);

  // Combinaciones ya jugadas contra un sorteo con resultado (2026-07-15 = 8, 11, 15, 18, 19, 29).
  const [[user]] = await conn.query("SELECT id FROM usuarios WHERE usuario = 'normal.prueba'");
  for (const numbers of [[8, 11, 15, 18, 19, 29], [1, 2, 3, 4, 5, 6], [8, 11, 1, 2, 3, 4]]) {
    await conn.query(
      "INSERT INTO combinaciones (usuario_id, juego_id, estrategia, numeros, fecha_sorteo_objetivo) VALUES (?, 1, 'AZAR', ?, '2026-07-15')",
      [user.id, JSON.stringify(numbers)]
    );
  }

  const list = await api.request('GET', '/combinaciones?pageSize=10', { token: tokens.NORMAL });
  const evaluated = list.data.items.filter((c) => c.aciertos !== null).map((c) => c.aciertos).sort();
  assert.deepEqual(evaluated, [0, 2, 6]);
  assert.equal(list.data.items.find((c) => c.aciertos === 6).resultado.join('-'), '8-11-15-18-19-29');
  assert.equal(list.data.items.find((c) => c.id === mine.data.id).aciertos, null, 'la del próximo sorteo sigue pendiente');

  const summary = await api.request('GET', '/combinaciones/resumen', { token: tokens.NORMAL });
  const azar = summary.data.estrategias.find((e) => e.estrategia === 'AZAR');
  assert.equal(azar.evaluadas, 3);
  assert.equal(azar.promedio, 2.67);
  assert.equal(summary.data.promedioPorAzar, 1.09);

  // Cada usuario ve y modifica solo lo suyo.
  assert.equal((await api.request('GET', '/combinaciones', { token: tokens.ADMIN })).data.total, 0);
  assert.equal((await api.request('PATCH', `/combinaciones/${mine.data.id}/jugada`, { token: tokens.ADMIN, body: { jugada: true } })).status, 404);
  assert.equal((await api.request('DELETE', `/combinaciones/${mine.data.id}`, { token: tokens.ADMIN })).status, 404);

  const played = await api.request('PATCH', `/combinaciones/${mine.data.id}/jugada`, { token: tokens.NORMAL, body: { jugada: true } });
  assert.equal(played.data.jugada, true);
  assert.equal((await api.request('DELETE', `/combinaciones/${mine.data.id}`, { token: tokens.NORMAL })).status, 200);
});
