-- Reemplaza sesiones_desde (una hora, con carreras dentro del mismo segundo) por un número de versión:
-- cada token lleva la versión vigente al emitirse y deja de valer cuando la cuenta pasa a una versión nueva
-- (al cambiar o restablecer la contraseña).
ALTER TABLE usuarios
  ADD COLUMN version_sesion INT UNSIGNED NOT NULL DEFAULT 0 AFTER debe_cambiar_password,
  DROP COLUMN sesiones_desde;
