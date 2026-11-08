-- Sorteo Loto SuperPremio 2026-11-07 (fuente: loto.hn): 02 03 04 05 11 13
-- Es seguro correrlo varias veces: si el sorteo ya existe (con sus números) no lo modifica.

START TRANSACTION;

SET @juego := (SELECT id FROM juegos WHERE codigo = 'SUPERPREMIO');
SET @fecha := '2026-11-07';

-- 1) Crear el sorteo si no existe
INSERT INTO sorteos (juego_id, fecha, fuente)
SELECT @juego, @fecha, 'SCRAPER'
WHERE NOT EXISTS (SELECT 1 FROM sorteos WHERE juego_id = @juego AND fecha = @fecha);

SET @sorteo := (SELECT id FROM sorteos WHERE juego_id = @juego AND fecha = @fecha);

-- 2) Números, solo si el sorteo no tiene ninguno
INSERT INTO sorteo_numeros (sorteo_id, posicion, numero)
SELECT @sorteo, p.posicion, p.numero
FROM (SELECT 1 posicion, 2 numero UNION ALL SELECT 2, 3 UNION ALL SELECT 3, 4
      UNION ALL SELECT 4, 5 UNION ALL SELECT 5, 11 UNION ALL SELECT 6, 13) p
WHERE NOT EXISTS (SELECT 1 FROM sorteo_numeros WHERE sorteo_id = @sorteo);

-- 3) Verificación: debe mostrar 02 03 04 05 11 13
SELECT s.fecha,
       GROUP_CONCAT(LPAD(sn.numero,2,'0') ORDER BY sn.posicion SEPARATOR ' ') AS en_bd
FROM sorteos s
JOIN sorteo_numeros sn ON sn.sorteo_id = s.id
WHERE s.id = @sorteo
GROUP BY s.id, s.fecha;

COMMIT;
