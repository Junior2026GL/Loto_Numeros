import test from 'node:test';
import assert from 'node:assert/strict';
import { assertValidPassword } from './password.js';

test('acepta una contraseña válida', () => {
  assert.doesNotThrow(() => assertValidPassword('Clave2026segura'));
});

test('rechaza menos de 8 caracteres, sin letra o sin número', () => {
  assert.throws(() => assertValidPassword('Ab1'), /al menos 8/);
  assert.throws(() => assertValidPassword('12345678'), /letra y un número/);
  assert.throws(() => assertValidPassword('soloLetrasAqui'), /letra y un número/);
  assert.throws(() => assertValidPassword(undefined), /al menos 8/);
});

test('rechaza una contraseña igual al usuario (sin importar mayúsculas)', () => {
  assert.throws(() => assertValidPassword('Admin12345', { usuario: 'admin12345' }), /igual al nombre de usuario/);
});

test('rechaza contraseñas absurdamente largas', () => {
  assert.throws(() => assertValidPassword('a1'.repeat(70)), /128/);
});
