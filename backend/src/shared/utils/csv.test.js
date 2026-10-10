import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from './csv.js';

const columns = [
  { header: 'a', value: (r) => r.a },
  { header: 'b', value: (r) => r.b },
];

test('genera encabezado, filas, BOM y saltos de línea CRLF', () => {
  const csv = toCsv([{ a: 1, b: 'x' }, { a: 2, b: 'y' }], columns);
  assert.equal(csv, '﻿a,b\r\n1,x\r\n2,y\r\n');
});

test('escapa comas, comillas y saltos de línea', () => {
  const csv = toCsv([{ a: 'uno, dos', b: 'dijo "hola"\nadiós' }], columns);
  assert.equal(csv, '﻿a,b\r\n"uno, dos","dijo ""hola""\nadiós"\r\n');
});

test('neutraliza fórmulas de Excel en el texto, pero no en los números', () => {
  const csv = toCsv([{ a: '=SUMA(A1)', b: '@cmd' }, { a: -5, b: '+1' }], columns);
  assert.ok(csv.includes("'=SUMA(A1),'@cmd"));
  assert.ok(csv.includes('\r\n-5,\'+1'));
});

test('los valores vacíos quedan como celdas vacías', () => {
  assert.equal(toCsv([{ a: null, b: undefined }], columns), '﻿a,b\r\n,\r\n');
});
