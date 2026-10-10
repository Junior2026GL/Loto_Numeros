import './env.js';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, insertUser, startApi } from './helpers.js';
import { db } from '../src/infrastructure/database/mysql.js';
import { todayInHonduras } from '../src/shared/utils/dates.js';

let conn;
let api;
let tokens;

before(async () => {
  conn = await createTestDatabase();
  api = await startApi();
  await insertUser(conn, { usuario: 'jugador.uno', rol: 'NORMAL' });
  await insertUser(conn, { usuario: 'jugador.dos', rol: 'NORMAL' });
  tokens = {
    SUPER_ADMIN: (await api.login('superadmin')).token,
    UNO: (await api.login('jugador.uno')).token,
    DOS: (await api.login('jugador.dos')).token,
  };
});

after(async () => {
  await api.close();
  await db.end();
  await conn.end();
});

const post = (path, token, body) => api.request('POST', path, { token, body });

test('generar: respeta números fijos y excluidos, y devuelve varias combinaciones por estrategia', async () => {
  const res = await post('/combinaciones/generar', tokens.UNO, { fijos: [7, 21], excluidos: [1, 2, 3, 4, 5], cantidad: 3 });
  assert.equal(res.status, 200);
  assert.equal(res.data.estrategias.length, 7);
  for (const s of res.data.estrategias) {
    assert.equal(s.combinaciones.length, 3, `${s.codigo} debe tener 3`);
    for (const combo of s.combinaciones) {
      assert.equal(combo.length, 6);
      assert.ok(combo.includes(7) && combo.includes(21), `${s.codigo}: faltan los fijos en ${combo}`);
      assert.ok(combo.every((n) => ![1, 2, 3, 4, 5].includes(n)), `${s.codigo}: usó un excluido en ${combo}`);
    }
    assert.deepEqual(s.numeros, s.combinaciones[0]);
  }
  assert.deepEqual(res.data.opciones.fijos, [7, 21]);
});

test('generar: modo equilibrado y validaciones de las opciones', async () => {
  const balanced = await post('/combinaciones/generar', tokens.UNO, { equilibrada: true });
  assert.equal(balanced.status, 200);
  for (const s of balanced.data.estrategias) {
    const evens = s.numeros.filter((n) => n % 2 === 0).length;
    assert.ok(evens >= 2 && evens <= 4, `${s.codigo}: ${s.numeros} tiene ${evens} pares`);
  }

  const bad = [
    [{ fijos: [1, 2, 3, 4, 5, 6] }, /como máximo 5/],
    [{ fijos: [1], excluidos: [1] }, /fijo y excluido/],
    [{ excluidos: Array.from({ length: 28 }, (_, i) => i + 1) }, /demasiados números/],
    [{ fijos: [40] }, /entre 1 y 33/],
    [{ fijos: [3, 3] }, /no pueden repetirse/],
    [{ fijos: 'x' }, /lista de números/],
    [{ cantidad: 11 }, /entre 1 y 10/],
    [{ cantidad: 0 }, /entre 1 y 10/],
  ];
  for (const [body, message] of bad) {
    const res = await post('/combinaciones/generar', tokens.UNO, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.match(res.message, message);
  }
});

test('probabilidades: tabla exacta y precio del boleto', async () => {
  const res = await api.request('GET', '/combinaciones/probabilidades', { token: tokens.UNO });
  assert.equal(res.status, 200);
  assert.equal(res.data.combinacionesPosibles, 1107568);
  assert.equal(res.data.filas.length, 7);
  assert.equal(res.data.filas[0].aciertos, 6);
  assert.equal(res.data.filas[0].unoEn, 1107568);
  assert.equal(res.data.precioBoleto, 20);
  assert.equal((await api.request('GET', '/combinaciones/probabilidades', {})).status, 401);
});

test('cobertura: arma boletos, calcula el costo y valida el grupo', async () => {
  const ok = await post('/combinaciones/cobertura', tokens.UNO, { grupo: [3, 8, 12, 15, 20, 25, 27, 31, 33], garantia: 3 });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.totalBoletos >= 5);
  assert.equal(ok.data.costoTotal, ok.data.totalBoletos * 20);
  assert.ok(ok.data.probabilidadActivacion > 0 && ok.data.probabilidadActivacion < 1);
  for (const ticket of ok.data.combinaciones) assert.equal(ticket.length, 6);

  assert.match((await post('/combinaciones/cobertura', tokens.UNO, { grupo: [1, 2, 3, 4, 5, 6], garantia: 3 })).message, /más de 6/);
  assert.match((await post('/combinaciones/cobertura', tokens.UNO, { grupo: [1, 2, 3, 4, 5, 6, 7], garantia: 1 })).message, /entre 2 y 5/);
  assert.equal((await post('/combinaciones/cobertura', tokens.UNO, { grupo: [1, 2, 3, 4, 5, 6, 7], garantia: 'x' })).status, 400);
  assert.equal((await post('/combinaciones/cobertura', tokens.UNO, { grupo: [1, 99, 3, 4, 5, 6, 7], garantia: 3 })).status, 400);
});

test('simular: cuenta los aciertos que habría tenido una combinación', async () => {
  // El sorteo del 2026-07-15 (8, 11, 15, 18, 19, 29) está en los datos de arranque.
  const res = await post('/combinaciones/simular', tokens.UNO, { numeros: [8, 11, 15, 18, 19, 29] });
  assert.equal(res.status, 200);
  assert.equal(res.data.sorteos, 22);
  assert.equal(res.data.maximo, 6);
  assert.equal(Object.values(res.data.distribucion).reduce((a, b) => a + b, 0), 22);

  const last5 = await post('/combinaciones/simular', tokens.UNO, { numeros: [1, 2, 3, 4, 5, 6], ultimos: 5 });
  assert.equal(last5.data.sorteos, 5);

  assert.equal((await post('/combinaciones/simular', tokens.UNO, { numeros: [1, 2, 3] })).status, 400);
});

test('presupuesto: costo al jugar, límite mensual con confirmación, premios y privacidad', async () => {
  const next = (await post('/combinaciones/generar', tokens.UNO, {})).data.proximoSorteo;
  const save = async (numeros) => (await post('/combinaciones', tokens.UNO, { estrategia: 'MANUAL', numeros, fecha: next.fecha })).data;
  const a = await save([1, 5, 9, 14, 22, 30]);
  const b = await save([2, 6, 10, 15, 23, 31]);
  const c = await save([3, 7, 11, 16, 24, 32]);

  const initial = (await api.request('GET', '/combinaciones/presupuesto', { token: tokens.UNO })).data;
  assert.equal(initial.precioBoleto, 20);
  assert.equal(initial.limiteMensual, null);
  assert.equal(initial.total.gastado, 0);

  const played = (id, body = { jugada: true }) => api.request('PATCH', `/combinaciones/${id}/jugada`, { token: tokens.UNO, body });
  assert.equal((await played(a.id)).data.costo, 20);
  assert.equal((await played(b.id)).data.costo, 20);
  assert.equal((await played(b.id)).data.costo, 20, 'marcar dos veces no cobra dos veces');

  let budget = (await api.request('GET', '/combinaciones/presupuesto', { token: tokens.UNO })).data;
  assert.equal(budget.total.gastado, 40);
  assert.equal(budget.total.jugadas, 2);
  assert.equal(budget.total.saldo, -40);

  // Límite mensual: el siguiente boleto lo superaría y pide confirmación.
  const setLimit = (value) => api.request('PUT', '/combinaciones/presupuesto', { token: tokens.UNO, body: { limiteMensual: value } });
  assert.equal((await setLimit(-5)).status, 400);
  assert.equal((await setLimit('abc')).status, 400);
  assert.equal((await setLimit(50)).data.limiteMensual, 50);

  const blocked = await played(c.id);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.details.code, 'LIMIT_EXCEEDED');
  assert.equal(blocked.details.limite, 50);
  assert.equal(blocked.details.gastado, 40);

  const confirmed = await played(c.id, { jugada: true, confirmar: true });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.costo, 20);

  // Premios: solo sobre combinaciones jugadas.
  const prize = (id, premio) => api.request('PATCH', `/combinaciones/${id}/premio`, { token: tokens.UNO, body: { premio } });
  assert.equal((await prize(a.id, 150)).data.premio, 150);
  assert.equal((await prize(a.id, -1)).status, 400);
  assert.equal((await prize(a.id, 'x')).status, 400);

  budget = (await api.request('GET', '/combinaciones/presupuesto', { token: tokens.UNO })).data;
  assert.equal(budget.total.gastado, 60);
  assert.equal(budget.total.ganado, 150);
  assert.equal(budget.total.saldo, 90);

  // Desmarcar borra el costo y el premio.
  const unplayed = await played(a.id, { jugada: false });
  assert.equal(unplayed.data.costo, null);
  assert.equal(unplayed.data.premio, null);
  assert.equal((await prize(a.id, 10)).status, 400, 'sin jugar no se registra premio');

  // El otro usuario no ve ni toca nada de esto.
  const other = (await api.request('GET', '/combinaciones/presupuesto', { token: tokens.DOS })).data;
  assert.equal(other.total.gastado, 0);
  assert.equal(other.limiteMensual, null);
  assert.equal((await api.request('PATCH', `/combinaciones/${b.id}/premio`, { token: tokens.DOS, body: { premio: 5 } })).status, 404);

  // El límite se puede quitar.
  assert.equal((await setLimit(null)).data.limiteMensual, null);

  // El mes actual solo suma lo que corresponde a este mes.
  budget = (await api.request('GET', '/combinaciones/presupuesto', { token: tokens.UNO })).data;
  const sameMonth = next.fecha.slice(0, 7) === todayInHonduras().slice(0, 7);
  assert.equal(budget.mes.gastado, sameMonth ? 40 : 0);
});

test('el precio del boleto lo fija el superadmin y se usa al jugar', async () => {
  const settings = (await api.request('GET', '/configuracion', { token: tokens.SUPER_ADMIN })).data;
  assert.equal(settings.precioBoleto, 20);

  const put = (precioBoleto) => api.request('PUT', '/configuracion', {
    token: tokens.SUPER_ADMIN,
    body: { ventanaCalientes: settings.ventanaCalientes, pesos: settings.pesos, precioBoleto },
  });
  assert.equal((await put(-1)).status, 400);
  assert.equal((await put('abc')).status, 400);
  assert.equal((await put(35.5)).data.precioBoleto, 35.5);
  assert.equal((await api.request('GET', '/combinaciones/probabilidades', { token: tokens.DOS })).data.precioBoleto, 35.5);

  const next = (await post('/combinaciones/generar', tokens.DOS, {})).data.proximoSorteo;
  const combo = (await post('/combinaciones', tokens.DOS, { estrategia: 'AZAR', numeros: [4, 8, 12, 16, 20, 24], fecha: next.fecha })).data;
  const played = await api.request('PATCH', `/combinaciones/${combo.id}/jugada`, { token: tokens.DOS, body: { jugada: true } });
  assert.equal(played.data.costo, 35.5);

  // Guardar los demás ajustes sin enviar el precio no lo borra.
  assert.equal((await api.request('PUT', '/configuracion', {
    token: tokens.SUPER_ADMIN,
    body: { ventanaCalientes: 5, pesos: settings.pesos },
  })).data.precioBoleto, 35.5);
});

test('la exportación CSV incluye costo y premio', async () => {
  const response = await fetch(`${api.base}/combinaciones/exportar`, { headers: { Authorization: `Bearer ${tokens.UNO}` } });
  const lines = (await response.text()).replace(String.fromCharCode(0xfeff), '').trim().split('\r\n');
  assert.equal(lines[0], 'Creada,Estrategia,Números,Sorteo,Resultado,Aciertos,Jugada,Costo,Premio');
  assert.ok(lines.some((l) => l.endsWith(',Sí,20,')), 'una combinación jugada debe mostrar su costo');
});
