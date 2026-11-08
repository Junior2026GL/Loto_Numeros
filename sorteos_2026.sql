-- Sorteos Loto SuperPremio 2026 (fuente: loto.hn), 88 sorteos, 2026-01-03 a 2026-11-04.
-- Es seguro correrlo varias veces: solo agrega los sorteos que NO existen en la base.
-- Un sorteo que ya existe (con sus números) no se modifica.

START TRANSACTION;

SET @juego := (SELECT id FROM juegos WHERE codigo = 'SUPERPREMIO');

-- 1) Resultados a cargar
DROP TABLE IF EXISTS tmp_resultados_carga;
CREATE TABLE tmp_resultados_carga (
  fecha DATE PRIMARY KEY,
  n1 TINYINT UNSIGNED, n2 TINYINT UNSIGNED, n3 TINYINT UNSIGNED,
  n4 TINYINT UNSIGNED, n5 TINYINT UNSIGNED, n6 TINYINT UNSIGNED
);
INSERT INTO tmp_resultados_carga (fecha, n1, n2, n3, n4, n5, n6) VALUES
  ('2026-01-03', 6, 7, 19, 21, 22, 26),
  ('2026-01-07', 5, 6, 8, 26, 31, 33),
  ('2026-01-10', 1, 2, 6, 12, 19, 22),
  ('2026-01-14', 2, 4, 6, 25, 26, 27),
  ('2026-01-17', 2, 9, 14, 26, 28, 32),
  ('2026-01-21', 4, 7, 9, 10, 16, 23),
  ('2026-01-24', 1, 2, 3, 8, 10, 12),
  ('2026-01-28', 5, 7, 9, 14, 32, 33),
  ('2026-01-31', 3, 7, 8, 20, 21, 28),
  ('2026-02-04', 6, 11, 12, 17, 21, 23),
  ('2026-02-07', 5, 10, 19, 23, 30, 33),
  ('2026-02-11', 3, 13, 14, 16, 18, 24),
  ('2026-02-14', 4, 9, 10, 11, 20, 33),
  ('2026-02-18', 4, 5, 6, 11, 18, 26),
  ('2026-02-21', 9, 10, 15, 17, 19, 25),
  ('2026-02-25', 3, 6, 10, 14, 21, 22),
  ('2026-02-28', 1, 4, 6, 7, 13, 22),
  ('2026-03-04', 1, 14, 22, 27, 28, 30),
  ('2026-03-07', 4, 10, 14, 20, 22, 28),
  ('2026-03-11', 2, 18, 22, 23, 28, 33),
  ('2026-03-14', 5, 13, 20, 25, 28, 31),
  ('2026-03-18', 3, 5, 19, 21, 30, 33),
  ('2026-03-21', 5, 6, 13, 14, 19, 24),
  ('2026-03-25', 1, 6, 12, 19, 26, 29),
  ('2026-03-28', 6, 9, 13, 15, 19, 25),
  ('2026-04-01', 3, 21, 24, 25, 26, 31),
  ('2026-04-04', 19, 20, 23, 24, 27, 30),
  ('2026-04-08', 11, 16, 18, 19, 22, 33),
  ('2026-04-11', 2, 6, 19, 21, 30, 33),
  ('2026-04-15', 1, 3, 7, 16, 24, 31),
  ('2026-04-18', 1, 7, 17, 20, 28, 31),
  ('2026-04-22', 2, 10, 12, 23, 31, 32),
  ('2026-04-25', 7, 12, 17, 20, 21, 31),
  ('2026-04-29', 11, 14, 17, 18, 29, 31),
  ('2026-05-02', 4, 17, 18, 20, 28, 33),
  ('2026-05-06', 5, 7, 8, 18, 20, 26),
  ('2026-05-09', 1, 7, 9, 14, 30, 33),
  ('2026-05-13', 10, 14, 15, 19, 31, 32),
  ('2026-05-16', 7, 10, 12, 19, 21, 23),
  ('2026-05-20', 2, 9, 14, 19, 20, 26),
  ('2026-05-23', 5, 6, 9, 17, 24, 29),
  ('2026-05-27', 1, 9, 13, 14, 27, 31),
  ('2026-05-30', 4, 6, 7, 9, 13, 26),
  ('2026-06-03', 1, 16, 29, 30, 32, 33),
  ('2026-06-06', 5, 11, 12, 21, 30, 33),
  ('2026-06-10', 3, 6, 8, 10, 12, 13),
  ('2026-06-13', 1, 10, 12, 18, 30, 31),
  ('2026-06-17', 5, 11, 17, 24, 30, 31),
  ('2026-06-20', 2, 11, 14, 23, 25, 29),
  ('2026-06-24', 8, 10, 11, 13, 17, 32),
  ('2026-06-27', 6, 11, 14, 19, 23, 26),
  ('2026-07-01', 1, 4, 6, 18, 19, 20),
  ('2026-07-04', 4, 5, 11, 15, 20, 33),
  ('2026-07-08', 6, 8, 13, 17, 24, 26),
  ('2026-07-11', 1, 4, 13, 19, 21, 33),
  ('2026-07-15', 8, 11, 15, 18, 19, 29),
  ('2026-07-18', 5, 11, 15, 22, 27, 29),
  ('2026-07-22', 8, 10, 12, 21, 22, 30),
  ('2026-07-25', 13, 17, 20, 30, 31, 33),
  ('2026-07-29', 7, 10, 22, 23, 25, 30),
  ('2026-08-01', 2, 5, 7, 8, 14, 22),
  ('2026-08-05', 5, 10, 20, 21, 30, 32),
  ('2026-08-08', 1, 4, 5, 10, 20, 28),
  ('2026-08-12', 8, 9, 13, 15, 24, 27),
  ('2026-08-15', 5, 8, 16, 25, 26, 30),
  ('2026-08-19', 16, 20, 27, 29, 30, 33),
  ('2026-08-22', 10, 13, 16, 19, 21, 26),
  ('2026-08-26', 3, 9, 14, 16, 18, 19),
  ('2026-08-29', 7, 10, 18, 21, 26, 30),
  ('2026-09-02', 3, 7, 14, 18, 25, 31),
  ('2026-09-05', 9, 12, 18, 20, 23, 26),
  ('2026-09-09', 1, 2, 8, 23, 24, 25),
  ('2026-09-12', 6, 13, 14, 21, 25, 33),
  ('2026-09-16', 3, 7, 12, 13, 15, 18),
  ('2026-09-19', 3, 9, 10, 13, 18, 29),
  ('2026-09-23', 10, 12, 15, 22, 23, 28),
  ('2026-09-26', 9, 10, 20, 30, 31, 32),
  ('2026-09-30', 5, 9, 11, 20, 31, 33),
  ('2026-10-03', 4, 7, 11, 17, 20, 22),
  ('2026-10-07', 6, 9, 17, 25, 29, 30),
  ('2026-10-10', 1, 2, 7, 12, 14, 29),
  ('2026-10-14', 7, 8, 29, 30, 31, 33),
  ('2026-10-17', 2, 4, 5, 6, 14, 23),
  ('2026-10-21', 7, 16, 20, 26, 29, 31),
  ('2026-10-24', 2, 5, 8, 23, 25, 30),
  ('2026-10-28', 1, 14, 21, 22, 27, 31),
  ('2026-10-31', 5, 7, 9, 12, 19, 29),
  ('2026-11-04', 8, 20, 21, 23, 31, 32);

-- 2) Qué fechas faltan (revisa esta lista antes del COMMIT)
SELECT t.fecha AS fecha_que_falta
FROM tmp_resultados_carga t
LEFT JOIN sorteos s ON s.juego_id = @juego AND s.fecha = t.fecha
WHERE s.id IS NULL
ORDER BY t.fecha;

-- 3) Crear los sorteos que faltan
INSERT INTO sorteos (juego_id, fecha, fuente)
SELECT @juego, t.fecha, 'SCRAPER'
FROM tmp_resultados_carga t
LEFT JOIN sorteos s ON s.juego_id = @juego AND s.fecha = t.fecha
WHERE s.id IS NULL;

-- 4) Números solo para sorteos que no tienen ninguno
INSERT INTO sorteo_numeros (sorteo_id, posicion, numero)
SELECT s.id, p.posicion,
       ELT(p.posicion, t.n1, t.n2, t.n3, t.n4, t.n5, t.n6)
FROM tmp_resultados_carga t
JOIN sorteos s ON s.juego_id = @juego AND s.fecha = t.fecha
JOIN (SELECT 1 posicion UNION ALL SELECT 2 UNION ALL SELECT 3
      UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) p
WHERE NOT EXISTS (SELECT 1 FROM sorteo_numeros sn WHERE sn.sorteo_id = s.id);

-- 5) Verificación: sorteos de la BD que no coinciden con la fuente (debe salir vacío)
SELECT s.fecha,
       GROUP_CONCAT(LPAD(sn.numero,2,'0') ORDER BY sn.posicion SEPARATOR ' ') AS en_bd
FROM tmp_resultados_carga t
JOIN sorteos s ON s.juego_id = @juego AND s.fecha = t.fecha
JOIN sorteo_numeros sn ON sn.sorteo_id = s.id
GROUP BY s.id, s.fecha, t.n1, t.n2, t.n3, t.n4, t.n5, t.n6
HAVING CONCAT_WS(',', t.n1, t.n2, t.n3, t.n4, t.n5, t.n6)
    <> GROUP_CONCAT(sn.numero ORDER BY sn.posicion SEPARATOR ',')
ORDER BY s.fecha;

-- 6) Total en la base (debe ser al menos 88)
SELECT COUNT(*) AS sorteos_2026 FROM sorteos
WHERE juego_id = @juego AND fecha BETWEEN '2026-01-03' AND '2026-11-04';

DROP TABLE tmp_resultados_carga;
COMMIT;
