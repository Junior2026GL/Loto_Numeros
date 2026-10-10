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
  };
});

after(async () => {
  await api.close();
  await db.end();
  await conn.end();
});

async function download(path, token) {
  const response = await fetch(api.base + path, { headers: { Authorization: `Bearer ${token}` } });
  return { status: response.status, type: response.headers.get('content-type'), disposition: response.headers.get('content-disposition'), text: await response.text() };
}

test('configuración: solo el superadmin la ve y la edita, y valida los valores', async () => {
  assert.equal((await api.request('GET', '/configuracion', { token: tokens.ADMIN })).status, 403);
  assert.equal((await api.request('PUT', '/configuracion', { token: tokens.NORMAL, body: {} })).status, 403);

  const current = await api.request('GET', '/configuracion', { token: tokens.SUPER_ADMIN });
  assert.deepEqual(current.data, { ventanaCalientes: 5, pesos: { frecuencia: 50, atraso: 35, caliente: 15 } });

  const put = (body) => api.request('PUT', '/configuracion', { token: tokens.SUPER_ADMIN, body });
  assert.equal((await put({ ventanaCalientes: 0, pesos: { frecuencia: 1, atraso: 1, caliente: 1 } })).status, 400);
  assert.equal((await put({ ventanaCalientes: 5, pesos: { frecuencia: 101, atraso: 0, caliente: 0 } })).status, 400);
  assert.equal((await put({ ventanaCalientes: 5, pesos: { frecuencia: -1, atraso: 0, caliente: 0 } })).status, 400);
  assert.match((await put({ ventanaCalientes: 5, pesos: { frecuencia: 0, atraso: 0, caliente: 0 } })).message, /mayor que 0/);
  assert.equal((await put({ ventanaCalientes: 'abc', pesos: { frecuencia: 1, atraso: 1, caliente: 1 } })).status, 400);

  const saved = await put({ ventanaCalientes: 3, pesos: { frecuencia: 10, atraso: 20, caliente: 70 } });
  assert.equal(saved.status, 200);

  // El cambio se refleja de inmediato en las estadísticas.
  const stats = await api.request('GET', '/estadisticas', { token: tokens.NORMAL });
  assert.equal(stats.data.ventanaCalientes, 3);

  const audit = await api.request('GET', '/auditoria?modulo=CONFIGURACION', { token: tokens.SUPER_ADMIN });
  assert.equal(audit.data.total, 1);
});

test('estadísticas incluyen la prueba de uniformidad', async () => {
  const { data } = await api.request('GET', '/estadisticas', { token: tokens.NORMAL });
  assert.equal(data.uniformidad.gradosLibertad, 32);
  assert.ok(data.uniformidad.pValor >= 0 && data.uniformidad.pValor <= 1);
  assert.ok(data.uniformidad.chi2 >= 0);
});

test('combinación manual: se guarda con su nombre y se valida igual que las generadas', async () => {
  const save = (body) => api.request('POST', '/combinaciones', { token: tokens.NORMAL, body });
  assert.equal((await save({ estrategia: 'MANUAL', numeros: [1, 2, 3] })).status, 400);
  assert.equal((await save({ estrategia: 'MANUAL', numeros: [1, 2, 3, 4, 5, 34] })).status, 400);

  const ok = await save({ estrategia: 'MANUAL', numeros: [30, 7, 12, 1, 25, 18] });
  assert.equal(ok.status, 201);
  assert.deepEqual(ok.data.numeros, [1, 7, 12, 18, 25, 30]);

  const list = await api.request('GET', '/combinaciones', { token: tokens.NORMAL });
  assert.equal(list.data.items[0].estrategia_nombre, 'Manual');
});

test('prueba retrospectiva: devuelve una fila por estrategia y limita los parámetros', async () => {
  const res = await api.request('GET', '/combinaciones/prueba-retrospectiva?combinaciones=10&minimo=10', { token: tokens.NORMAL });
  assert.equal(res.status, 200);
  assert.equal(res.data.estrategias.length, 7);
  assert.equal(res.data.sorteosEvaluados, 12); // 22 sorteos - 10 de historia mínima
  assert.equal(res.data.promedioPorAzar, 1.09);

  const clamped = await api.request('GET', '/combinaciones/prueba-retrospectiva?combinaciones=999999&minimo=-5', { token: tokens.NORMAL });
  assert.equal(clamped.data.combinacionesPorSorteo, 200);
  assert.equal((await api.request('GET', '/combinaciones/prueba-retrospectiva', {})).status, 401);
});

test('exportar sorteos a CSV respeta los filtros y requiere sesión', async () => {
  const all = await download('/sorteos/exportar', tokens.NORMAL);
  assert.equal(all.status, 200);
  assert.match(all.type, /text\/csv/);
  assert.match(all.disposition, /sorteos\.csv/);
  const lines = all.text.replace(/^\uFEFF/, '').trim().split('\r\n');
  assert.equal(lines[0], 'Fecha,Día,Número 1,Número 2,Número 3,Número 4,Número 5,Número 6,Origen');
  assert.equal(lines.length, 23); // encabezado + 22 sorteos, todos (no solo la primera página)
  assert.equal(lines[1], '2026-07-15,miércoles,8,11,15,18,19,29,IMPORTACION');

  const saturdaysMay = await download('/sorteos/exportar?anio=2026&mes=5&dia=6', tokens.NORMAL);
  assert.equal(saturdaysMay.text.trim().split('\r\n').length, 6); // encabezado + 5 sábados

  assert.equal((await fetch(api.base + '/sorteos/exportar')).status, 401);
});

test('exportar combinaciones: incluye todas las del usuario, con aciertos y resultado', async () => {
  const [[user]] = await conn.query("SELECT id FROM usuarios WHERE usuario = 'normal.prueba'");
  await conn.query(
    "INSERT INTO combinaciones (usuario_id, juego_id, estrategia, numeros, fecha_sorteo_objetivo) VALUES (?, 1, 'AZAR', ?, '2026-07-15')",
    [user.id, JSON.stringify([8, 11, 15, 18, 19, 29])]
  );
  // Más de 50 combinaciones: la exportación no debe quedarse en la primera página.
  for (let i = 0; i < 60; i += 1) {
    await conn.query(
      "INSERT INTO combinaciones (usuario_id, juego_id, estrategia, numeros, fecha_sorteo_objetivo) VALUES (?, 1, 'AZAR', ?, '2030-01-02')",
      [user.id, JSON.stringify([1, 2, 3, 4, 5, 6])]
    );
  }

  const csv = await download('/combinaciones/exportar', tokens.NORMAL);
  assert.equal(csv.status, 200);
  const lines = csv.text.replace(/^\uFEFF/, '').trim().split('\r\n');
  assert.equal(lines[0], 'Creada,Estrategia,Números,Sorteo,Resultado,Aciertos,Jugada');
  assert.ok(lines.length >= 62, `solo ${lines.length} líneas`);
  assert.ok(lines.some((l) => l.includes('8-11-15-18-19-29,2026-07-15,8-11-15-18-19-29,6,No')));

  // Cada usuario exporta solo lo suyo.
  const other = await download('/combinaciones/exportar', tokens.ADMIN);
  assert.equal(other.text.replace(/^\uFEFF/, '').trim().split('\r\n').length, 1);
});
