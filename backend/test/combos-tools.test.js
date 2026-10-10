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
  assert.equal(res.data.precioBoleto, 10);
  assert.equal(res.data.precioDoble, 20);
  assert.equal((await api.request('GET', '/combinaciones/probabilidades', {})).status, 401);
});

test('cobertura: arma boletos, calcula el costo y valida el grupo', async () => {
  const ok = await post('/combinaciones/cobertura', tokens.UNO, { grupo: [3, 8, 12, 15, 20, 25, 27, 31, 33], garantia: 3 });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.totalBoletos >= 5);
  assert.equal(ok.data.costoTotal, ok.data.totalBoletos * 10);
  assert.equal(ok.data.costoTotalDoble, ok.data.totalBoletos * 20);
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

test('presupuesto: jugada sencilla y doble, límite mensual con confirmación, premios y privacidad', async () => {
  const next = (await post('/combinaciones/generar', tokens.UNO, {})).data.proximoSorteo;
  const save = async (numeros) => (await post('/combinaciones', tokens.UNO, { estrategia: 'MANUAL', numeros, fecha: next.fecha })).data;
  const a = await save([1, 5, 9, 14, 22, 30]);
  const b = await save([2, 6, 10, 15, 23, 31]);
  const c = await save([3, 7, 11, 16, 24, 32]);

  const initial = (await api.request('GET', '/combinaciones/presupuesto', { token: tokens.UNO })).data;
  assert.equal(initial.precioBoleto, 10);
  assert.equal(initial.precioDoble, 20);
  assert.equal(initial.limiteMensual, null);
  assert.equal(initial.total.gastado, 0);

  const played = (id, body = { jugada: true }) => api.request('PATCH', `/combinaciones/${id}/jugada`, { token: tokens.UNO, body });
  const budgetNow = async () => (await api.request('GET', '/combinaciones/presupuesto', { token: tokens.UNO })).data;

  const first = await played(a.id);
  assert.equal(first.data.costo, 10);
  assert.equal(first.data.modalidad, 'SENCILLA');
  const double = await played(b.id, { jugada: true, modalidad: 'DOBLE' });
  assert.equal(double.data.costo, 20);
  assert.equal(double.data.modalidad, 'DOBLE');
  assert.equal((await played(b.id, { jugada: true, modalidad: 'DOBLE' })).data.costo, 20, 'marcar dos veces no cobra dos veces');
  assert.equal((await played(c.id, { jugada: true, modalidad: 'TRIPLE' })).status, 400);

  let budget = await budgetNow();
  assert.equal(budget.total.gastado, 30);
  assert.equal(budget.total.jugadas, 2);
  assert.equal(budget.total.saldo, -30);

  // Cambiar de modalidad ajusta el costo en vez de sumarlo.
  assert.equal((await played(b.id, { jugada: true, modalidad: 'SENCILLA' })).data.costo, 10);
  assert.equal((await budgetNow()).total.gastado, 20);
  assert.equal((await played(b.id, { jugada: true, modalidad: 'DOBLE' })).data.costo, 20);
  assert.equal((await budgetNow()).total.gastado, 30);

  // Límite mensual: la siguiente jugada lo superaría y pide confirmación.
  const setLimit = (value) => api.request('PUT', '/combinaciones/presupuesto', { token: tokens.UNO, body: { limiteMensual: value } });
  assert.equal((await setLimit(-5)).status, 400);
  assert.equal((await setLimit('abc')).status, 400);
  assert.equal((await setLimit(35)).data.limiteMensual, 35);

  const blocked = await played(c.id);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.details.code, 'LIMIT_EXCEEDED');
  assert.equal(blocked.details.limite, 35);
  assert.equal(blocked.details.gastado, 30);
  assert.equal(blocked.details.costo, 10);

  const confirmed = await played(c.id, { jugada: true, confirmar: true });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.costo, 10);

  // Pasar a doble una combinación ya jugada: el límite solo mira lo que aumenta.
  const upgrade = await played(a.id, { jugada: true, modalidad: 'DOBLE' });
  assert.equal(upgrade.status, 409);
  assert.equal(upgrade.details.costo, 10, 'solo cuenta la diferencia (20 - 10)');
  assert.equal((await played(a.id, { jugada: true, modalidad: 'DOBLE', confirmar: true })).data.costo, 20);

  // Premios: solo sobre combinaciones jugadas.
  const prize = (id, premio) => api.request('PATCH', `/combinaciones/${id}/premio`, { token: tokens.UNO, body: { premio } });
  assert.equal((await prize(a.id, 150)).data.premio, 150);
  assert.equal((await prize(a.id, -1)).status, 400);
  assert.equal((await prize(a.id, 'x')).status, 400);

  budget = await budgetNow();
  assert.equal(budget.total.gastado, 50);
  assert.equal(budget.total.ganado, 150);
  assert.equal(budget.total.saldo, 100);

  // Desmarcar borra el costo, la modalidad y el premio.
  const unplayed = await played(a.id, { jugada: false });
  assert.equal(unplayed.data.costo, null);
  assert.equal(unplayed.data.premio, null);
  assert.equal(unplayed.data.modalidad, 'SENCILLA');
  assert.equal((await prize(a.id, 10)).status, 400, 'sin jugar no se registra premio');

  // El otro usuario no ve ni toca nada de esto.
  const other = (await api.request('GET', '/combinaciones/presupuesto', { token: tokens.DOS })).data;
  assert.equal(other.total.gastado, 0);
  assert.equal(other.limiteMensual, null);
  assert.equal((await api.request('PATCH', `/combinaciones/${b.id}/premio`, { token: tokens.DOS, body: { premio: 5 } })).status, 404);

  // El límite se puede quitar.
  assert.equal((await setLimit(null)).data.limiteMensual, null);

  // El mes actual solo suma lo que corresponde a este mes (b doble 20 + c sencilla 10).
  budget = await budgetNow();
  const sameMonth = next.fecha.slice(0, 7) === todayInHonduras().slice(0, 7);
  assert.equal(budget.mes.gastado, sameMonth ? 30 : 0);
});

test('los precios los fija el superadmin y se usan al jugar', async () => {
  const settings = (await api.request('GET', '/configuracion', { token: tokens.SUPER_ADMIN })).data;
  assert.equal(settings.precioBoleto, 10);
  assert.equal(settings.precioDoble, 20);

  const put = (precioBoleto, precioDoble) => api.request('PUT', '/configuracion', {
    token: tokens.SUPER_ADMIN,
    body: { ventanaCalientes: settings.ventanaCalientes, pesos: settings.pesos, precioBoleto, precioDoble },
  });
  assert.equal((await put(-1, 20)).status, 400);
  assert.equal((await put(10, -1)).status, 400);
  assert.equal((await put('abc', 20)).status, 400);
  const changed = (await put(35.5, 70)).data;
  assert.equal(changed.precioBoleto, 35.5);
  assert.equal(changed.precioDoble, 70);

  const odds = (await api.request('GET', '/combinaciones/probabilidades', { token: tokens.DOS })).data;
  assert.equal(odds.precioBoleto, 35.5);
  assert.equal(odds.precioDoble, 70);

  const next = (await post('/combinaciones/generar', tokens.DOS, {})).data.proximoSorteo;
  const combo = (await post('/combinaciones', tokens.DOS, { estrategia: 'AZAR', numeros: [4, 8, 12, 16, 20, 24], fecha: next.fecha })).data;
  const play = (modalidad) => api.request('PATCH', `/combinaciones/${combo.id}/jugada`, { token: tokens.DOS, body: { jugada: true, modalidad } });
  assert.equal((await play('SENCILLA')).data.costo, 35.5);
  assert.equal((await play('DOBLE')).data.costo, 70);

  // Guardar los demás ajustes sin enviar los precios no los borra.
  const kept = (await api.request('PUT', '/configuracion', {
    token: tokens.SUPER_ADMIN,
    body: { ventanaCalientes: 5, pesos: settings.pesos },
  })).data;
  assert.equal(kept.precioBoleto, 35.5);
  assert.equal(kept.precioDoble, 70);
});

test('la exportación CSV incluye modalidad, costo y premio', async () => {
  const response = await fetch(`${api.base}/combinaciones/exportar`, { headers: { Authorization: `Bearer ${tokens.UNO}` } });
  const lines = (await response.text()).replace(String.fromCharCode(0xfeff), '').trim().split('\r\n');
  assert.equal(lines[0], 'Creada,Estrategia,Números,Sorteo,Resultado,Aciertos,Jugada,Modalidad,Costo,Premio');
  assert.ok(lines.some((l) => l.endsWith(',Sí,Doble,20,')), 'una jugada doble debe mostrar su modalidad y costo');
  assert.ok(lines.some((l) => l.endsWith(',Sí,Sencilla,10,')), 'una jugada sencilla debe mostrar su modalidad y costo');
});
