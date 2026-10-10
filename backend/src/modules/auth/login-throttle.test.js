import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginThrottle } from './login-throttle.js';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

const MIN = 60_000;

test('bloquea después de 5 fallos y avisa los minutos restantes', () => {
  const c = clock();
  const throttle = createLoginThrottle({ now: c.now });
  for (let i = 0; i < 4; i += 1) throttle.registerFailure('u');
  assert.equal(throttle.minutesLocked('u'), 0);
  throttle.registerFailure('u');
  assert.equal(throttle.minutesLocked('u'), 15);
  c.advance(5 * MIN);
  assert.equal(throttle.minutesLocked('u'), 10);
});

test('el bloqueo termina a los 15 minutos', () => {
  const c = clock();
  const throttle = createLoginThrottle({ now: c.now });
  for (let i = 0; i < 5; i += 1) throttle.registerFailure('u');
  c.advance(15 * MIN + 1);
  assert.equal(throttle.minutesLocked('u'), 0);
});

test('un login correcto limpia los intentos', () => {
  const throttle = createLoginThrottle({ now: clock().now });
  for (let i = 0; i < 4; i += 1) throttle.registerFailure('u');
  throttle.clear('u');
  throttle.registerFailure('u');
  assert.equal(throttle.minutesLocked('u'), 0);
});

test('los fallos antiguos (fuera de la ventana) no se acumulan', () => {
  const c = clock();
  const throttle = createLoginThrottle({ now: c.now });
  for (let i = 0; i < 4; i += 1) throttle.registerFailure('u');
  c.advance(16 * MIN);
  throttle.registerFailure('u'); // empieza de cero: solo 1 fallo reciente
  assert.equal(throttle.minutesLocked('u'), 0);
});

test('cada usuario se cuenta por separado', () => {
  const throttle = createLoginThrottle({ now: clock().now });
  for (let i = 0; i < 5; i += 1) throttle.registerFailure('a');
  assert.equal(throttle.minutesLocked('a'), 15);
  assert.equal(throttle.minutesLocked('b'), 0);
});

test('el mapa se limpia solo: no crece sin límite', () => {
  const c = clock();
  const throttle = createLoginThrottle({ now: c.now });
  for (let i = 0; i < 1000; i += 1) throttle.registerFailure(`intruso${i}`);
  assert.equal(throttle.size, 1000);
  c.advance(20 * MIN);
  throttle.registerFailure('nuevo');
  assert.equal(throttle.size, 1);
});

test('no limpia a quien sigue bloqueado', () => {
  const c = clock();
  const throttle = createLoginThrottle({ now: c.now });
  for (let i = 0; i < 5; i += 1) throttle.registerFailure('bloqueado');
  c.advance(10 * MIN);
  throttle.registerFailure('otro'); // dispara la limpieza
  assert.ok(throttle.minutesLocked('bloqueado') > 0);
});
