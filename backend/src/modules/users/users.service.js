import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from '../../shared/errors/AppError.js';
import { ROLE_LIST } from '../../shared/constants/roles.js';
import { normalizePhone } from '../../shared/utils/phone.js';
import * as repository from './users.repository.js';

const usernamePattern = /^[a-zA-Z0-9._-]{3,40}$/;

const createSchema = z.object({
  nombre: z.string().trim().min(3, 'El nombre es obligatorio'),
  usuario: z.string().trim().regex(usernamePattern, 'Usuario inválido (letras, números, puntos, guiones)'),
  email: z.string().trim().toLowerCase().email('Correo inválido').optional().or(z.literal('')),
  telefono: z.string().trim().optional().or(z.literal('')),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rol: z.enum(ROLE_LIST, { errorMap: () => ({ message: 'Rol inválido' }) }),
});

const updateSchema = z.object({
  nombre: z.string().trim().min(3, 'El nombre es obligatorio'),
  usuario: z.string().trim().regex(usernamePattern, 'Usuario inválido (letras, números, puntos, guiones)'),
  email: z.string().trim().toLowerCase().email('Correo inválido').optional().or(z.literal('')),
  telefono: z.string().trim().optional().or(z.literal('')),
  rol: z.enum(ROLE_LIST, { errorMap: () => ({ message: 'Rol inválido' }) }),
});

function resolvePhone(telefono) {
  if (!telefono) return null;
  const digits = normalizePhone(telefono);
  if (digits.length < 8) throw new AppError('El teléfono no es válido');
  return digits;
}

function validate(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message || 'Datos inválidos', 400);
  }
  return result.data;
}

async function resolveRoleId(rolNombre) {
  const roles = await repository.listRoles();
  const role = roles.find((r) => r.nombre === rolNombre);
  if (!role) throw new AppError('Rol inválido');
  return role.id;
}

export function list() {
  return repository.listUsers();
}

export function roles() {
  return repository.listRoles();
}

export async function getById(id) {
  const user = await repository.findUserById(id);
  if (!user) throw new AppError('Usuario no encontrado', 404);
  return user;
}

export async function create(payload) {
  const data = validate(createSchema, payload);

  const existing = await repository.findUsernameOwner(data.usuario);
  if (existing) throw new AppError('Ya existe un usuario con ese nombre de usuario');

  const rolId = await resolveRoleId(data.rol);
  const telefono = resolvePhone(data.telefono);
  const passwordHash = await bcrypt.hash(data.password, 12);

  const id = await repository.createUser({
    nombre: data.nombre,
    usuario: data.usuario,
    email: data.email || null,
    telefono,
    passwordHash,
    rolId,
  });

  return getById(id);
}

export async function update(id, payload) {
  await getById(id);
  const data = validate(updateSchema, payload);

  const existing = await repository.findUsernameOwner(data.usuario);
  if (existing && Number(existing.id) !== Number(id)) {
    throw new AppError('Ya existe un usuario con ese nombre de usuario');
  }

  const rolId = await resolveRoleId(data.rol);
  const telefono = resolvePhone(data.telefono);
  await repository.updateUser(id, {
    nombre: data.nombre,
    usuario: data.usuario,
    email: data.email || null,
    telefono,
    rolId,
  });
  return getById(id);
}

export async function resetPassword(id, password) {
  await getById(id);
  if (!password || password.length < 8) {
    throw new AppError('La contraseña debe tener al menos 8 caracteres');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await repository.updatePassword(id, passwordHash);
  return { ok: true };
}

export async function setActive(id, activo, currentUserId) {
  const user = await getById(id);
  if (Number(user.id) === Number(currentUserId) && !activo) {
    throw new AppError('No puedes desactivar tu propio usuario');
  }
  await repository.setActive(id, activo);
  return getById(id);
}
