-- ============================================================================
-- LOTO NÚMEROS · Roles y usuarios
-- Requiere haber ejecutado antes setup.sql (que crea las tablas).
-- Es seguro ejecutarlo varias veces: no duplica nada.
-- ============================================================================

USE loto_numeros;

-- ----------------------------------------------------------------------------
-- ROLES
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO roles (id, nombre, descripcion) VALUES
(1, 'SUPER_ADMIN', 'Control total del sistema'),
(2, 'ADMIN',       'Administra sorteos, sincronización y estadísticas'),
(3, 'NORMAL',      'Consulta resultados y genera combinaciones');

-- ----------------------------------------------------------------------------
-- SUPER ADMIN
-- Usuario:     superadmin
-- Contraseña:  la inicial que se te entregó por separado (cámbiala al ingresar)
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO usuarios (rol_id, nombre, usuario, password_hash, activo) VALUES
(1, 'Super Administrador', 'superadmin',
 '$2a$12$G9XSMiUIYlWK8bTxmj.mPOLu7vjdjA5SZflmfnE6SgJ3YobL9vr.6', 1);

-- ----------------------------------------------------------------------------
-- COMO CREAR OTROS USUARIOS (ADMIN o NORMAL)
-- Lo más fácil: entra como superadmin a la pantalla "Usuarios" y créalos ahí.
--
-- Si prefieres por SQL, genera primero el hash de la contraseña:
--     cd backend
--     node scripts/hash-password.js "ContraseñaSegura123"
-- y pégalo en el INSERT (rol_id: 2 = ADMIN, 3 = NORMAL):
--
-- INSERT INTO usuarios (rol_id, nombre, usuario, email, password_hash, activo)
-- VALUES (2, 'Nombre Apellido', 'nombre.usuario', 'correo@ejemplo.com', '<hash>', 1);
-- ----------------------------------------------------------------------------

-- Para recuperar acceso si olvidas la contraseña del superadmin:
-- UPDATE usuarios SET password_hash = '<hash nuevo>', activo = 1 WHERE usuario = 'superadmin';

-- Verificación: debe mostrar el superadmin con su rol
SELECT u.id, u.usuario, u.nombre, r.nombre AS rol, u.activo
FROM usuarios u
LEFT JOIN roles r ON r.id = u.rol_id;
