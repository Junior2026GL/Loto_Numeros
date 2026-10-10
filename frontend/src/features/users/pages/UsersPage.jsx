import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../components/PageHeader.jsx';
import Modal from '../../../components/Modal.jsx';
import Pagination from '../../../components/Pagination.jsx';
import { PasswordField, PasswordStrengthMeter } from '../../../components/PasswordField.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import {
  IconPlus,
  IconEdit,
  IconKey,
  IconPower,
  IconEye,
  IconUsers,
  IconSearch,
  IconUser,
  IconMail,
  IconPhone,
  IconShield,
  IconCalendar,
  IconCheck,
} from '../../../components/icons.jsx';
import {
  listUsers,
  listRoles,
  createUser,
  updateUser,
  setUserStatus,
  resetUserPassword,
} from '../services/users.service.js';

const roleLabels = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  NORMAL: 'Normal',
};

const roleMeta = {
  SUPER_ADMIN: { desc: 'Control total del sistema.', tone: 'amber' },
  ADMIN: { desc: 'Administración general.', tone: 'blue' },
  NORMAL: { desc: 'Usuario estándar.', tone: 'green' },
};

const emptyForm = { nombre: '', usuario: '', email: '', telefono: '', password: '', rol: 'NORMAL' };
const PAGE_SIZE = 20;

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function RolePicker({ roles, value, onChange }) {
  return (
    <div className="role-picker">
      {roles.map((r) => {
        const meta = roleMeta[r.nombre] || { desc: '', tone: 'blue' };
        const active = value === r.nombre;
        return (
          <label key={r.id} className={`role-option ${meta.tone} ${active ? 'active' : ''}`}>
            <input
              type="radio"
              name="rol"
              value={r.nombre}
              checked={active}
              onChange={() => onChange(r.nombre)}
            />
            <span className={`role-option-icon ${meta.tone}`}><IconShield width={16} height={16} /></span>
            <span className="role-option-text">
              <b>{roleLabels[r.nombre] || r.nombre}</b>
              <small>{meta.desc}</small>
            </span>
            <span className="role-option-check"><IconCheck width={13} height={13} /></span>
          </label>
        );
      })}
    </div>
  );
}

export default function UsersPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: '', usuario: '', email: '', telefono: '', rol: '' });
  const [editSaving, setEditSaving] = useState(false);

  const [resettingUser, setResettingUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  const [viewingUser, setViewingUser] = useState(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');
  const [page, setPage] = useState(1);

  const currentUser = JSON.parse(localStorage.getItem('loto_numeros_user') || 'null');

  async function load() {
    setLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([listUsers(), listRoles()]);
      setItems(usersData);
      setRoles(rolesData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function submitCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await createUser(form);
      setForm(emptyForm);
      setShowCreate(false);
      toast.success('Usuario creado correctamente.');
      await load();
    } catch (err) {
      const message = err.response?.data?.message || 'No se pudo crear el usuario';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(user) {
    setEditingUser(user);
    setEditForm({
      nombre: user.nombre,
      usuario: user.usuario,
      email: user.email || '',
      telefono: user.telefono || '',
      rol: user.rol,
    });
  }

  async function submitEdit(e) {
    e.preventDefault();
    setError('');
    setEditSaving(true);
    try {
      await updateUser(editingUser.id, editForm);
      setEditingUser(null);
      toast.success('Usuario actualizado correctamente.');
      await load();
    } catch (err) {
      const message = err.response?.data?.message || 'No se pudo actualizar el usuario';
      setError(message);
      toast.error(message);
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleActive(user) {
    setError('');
    try {
      await setUserStatus(user.id, !user.activo);
      toast.success(`Usuario ${user.activo ? 'desactivado' : 'activado'} correctamente.`);
      await load();
    } catch (err) {
      const message = err.response?.data?.message || 'No se pudo actualizar el estado';
      setError(message);
      toast.error(message);
    }
  }

  function startReset(user) {
    setNewPassword('');
    setResettingUser(user);
  }

  async function submitReset(e) {
    e.preventDefault();
    setError('');
    setResetSaving(true);
    try {
      await resetUserPassword(resettingUser.id, newPassword);
      setResettingUser(null);
      setNewPassword('');
      toast.success('Contraseña restablecida correctamente.');
    } catch (err) {
      const message = err.response?.data?.message || 'No se pudo restablecer la contraseña';
      setError(message);
      toast.error(message);
    } finally {
      setResetSaving(false);
    }
  }

  const stats = useMemo(() => {
    const activos = items.filter((u) => u.activo).length;
    const administradores = items.filter((u) => u.rol === 'SUPER_ADMIN' || u.rol === 'ADMIN').length;
    return { total: items.length, activos, inactivos: items.length - activos, administradores };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((u) => {
      const matchesRole = roleFilter === 'TODOS' || u.rol === roleFilter;
      const matchesSearch = !q
        || u.nombre?.toLowerCase().includes(q)
        || u.usuario?.toLowerCase().includes(q)
        || u.email?.toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }, [items, search, roleFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const paginatedItems = useMemo(
    () => filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredItems, page]
  );

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Gestión de accesos y roles del sistema."
      />

      <div className="users-page-actions">
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <IconPlus /> Nuevo usuario
        </button>
      </div>

      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="users-page-content">
        <div className="card-grid">
          <div className="stat-card blue">
            <div className="stat-card-icon blue"><IconUsers /></div>
            <span>Total de usuarios</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="stat-card green">
            <div className="stat-card-icon green"><IconCheck /></div>
            <span>Activos</span>
            <strong>{stats.activos}</strong>
          </div>
          <div className="stat-card red">
            <div className="stat-card-icon red"><IconPower /></div>
            <span>Inactivos</span>
            <strong>{stats.inactivos}</strong>
          </div>
          <div className="stat-card amber">
            <div className="stat-card-icon amber"><IconShield /></div>
            <span>Administradores</span>
            <strong>{stats.administradores}</strong>
          </div>
        </div>

      {showCreate && (
        <Modal
          title="Nuevo usuario"
          subtitle="Crea una cuenta de acceso al sistema."
          icon={<IconUser />}
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn-outline" onClick={() => setShowCreate(false)}>
                Cancelar
              </button>
              <button type="submit" form="form-crear-usuario" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Crear usuario'}
              </button>
            </>
          }
        >
          <form id="form-crear-usuario" className="form-sections" onSubmit={submitCreate}>
            <fieldset className="form-section">
              <legend>Información personal</legend>
              <div className="form-grid">
                <div>
                  <label>Nombre completo</label>
                  <div className="input-icon">
                    <IconUser />
                    <input
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="Ej. Ana Martínez"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label>Teléfono <span className="label-optional">(opcional)</span></label>
                  <div className="input-icon">
                    <IconPhone />
                    <input
                      type="tel"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      placeholder="9999-9999"
                    />
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Correo electrónico <span className="label-optional">(opcional)</span></label>
                  <div className="input-icon">
                    <IconMail />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="nombre@correo.com"
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Credenciales de acceso</legend>
              <div className="form-grid">
                <div>
                  <label>Usuario</label>
                  <div className="input-icon">
                    <IconUser />
                    <input
                      value={form.usuario}
                      onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                      autoComplete="username"
                      placeholder="usuario.acceso"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label>Contraseña</label>
                  <PasswordField
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mín. 8 caracteres"
                    autoComplete="new-password"
                  />
                  <PasswordStrengthMeter value={form.password} />
                </div>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Rol y permisos</legend>
              <RolePicker roles={roles} value={form.rol} onChange={(rol) => setForm({ ...form, rol })} />
            </fieldset>
          </form>
        </Modal>
      )}

      {editingUser && (
        <Modal
          title="Editar usuario"
          subtitle={editingUser.nombre}
          icon={<IconEdit />}
          onClose={() => setEditingUser(null)}
          footer={
            <>
              <button type="button" className="btn-outline" onClick={() => setEditingUser(null)}>
                Cancelar
              </button>
              <button type="submit" form="form-editar-usuario" className="btn-primary" disabled={editSaving}>
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </>
          }
        >
          <form id="form-editar-usuario" className="form-sections" onSubmit={submitEdit}>
            <fieldset className="form-section">
              <legend>Información personal</legend>
              <div className="form-grid">
                <div>
                  <label>Nombre completo</label>
                  <div className="input-icon">
                    <IconUser />
                    <input
                      value={editForm.nombre}
                      onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label>Teléfono <span className="label-optional">(opcional)</span></label>
                  <div className="input-icon">
                    <IconPhone />
                    <input
                      type="tel"
                      value={editForm.telefono}
                      onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                      placeholder="9999-9999"
                    />
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Correo electrónico <span className="label-optional">(opcional)</span></label>
                  <div className="input-icon">
                    <IconMail />
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Credenciales de acceso</legend>
              <div className="form-grid">
                <div>
                  <label>Usuario</label>
                  <div className="input-icon">
                    <IconUser />
                    <input
                      value={editForm.usuario}
                      onChange={(e) => setEditForm({ ...editForm, usuario: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Rol y permisos</legend>
              <RolePicker roles={roles} value={editForm.rol} onChange={(rol) => setEditForm({ ...editForm, rol })} />
            </fieldset>
          </form>
        </Modal>
      )}

      {resettingUser && (
        <Modal
          title="Restablecer contraseña"
          subtitle={resettingUser.nombre}
          icon={<IconKey />}
          onClose={() => setResettingUser(null)}
          width={440}
          footer={
            <>
              <button type="button" className="btn-outline" onClick={() => setResettingUser(null)}>
                Cancelar
              </button>
              <button type="submit" form="form-reset-password" className="btn-primary" disabled={resetSaving}>
                {resetSaving ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </>
          }
        >
          <form id="form-reset-password" className="form-stack" onSubmit={submitReset}>
            <div className="alert" style={{ marginBottom: 4 }}>
              El usuario deberá usar esta contraseña en su próximo inicio de sesión.
            </div>
            <label>Nueva contraseña</label>
            <PasswordField
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mín. 8 caracteres"
              autoComplete="new-password"
              autoFocus
            />
            <PasswordStrengthMeter value={newPassword} />
          </form>
        </Modal>
      )}

        <div className="panel table-wrap">
          <div className="users-toolbar">
            <div>
              <h3 className="panel-title" style={{ margin: 0 }}>Lista de usuarios</h3>
              <span className="badge-muted" style={{ marginTop: 8 }}>
                <IconUsers /> {filteredItems.length} de {items.length} usuario{items.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="users-filters">
              <div className="input-icon users-search">
                <IconSearch />
                <input
                  placeholder="Buscar por nombre, usuario o correo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="users-role-filter">
                <option value="TODOS">Todos los roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.nombre}>{roleLabels[r.nombre] || r.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="table-loading">
              {[0, 1, 2].map((i) => <div className="table-loading-row" key={i} />)}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">👤</span>
              <div className="empty-state-title">
                {items.length === 0 ? 'Sin usuarios registrados' : 'Sin resultados para tu búsqueda'}
              </div>
              <p>
                {items.length === 0
                  ? 'Crea el primer usuario para empezar a gestionar accesos.'
                  : 'Intenta con otro nombre, usuario, correo o filtro de rol.'}
              </p>
            </div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Último acceso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((user) => {
                  const meta = roleMeta[user.rol] || { tone: 'blue' };
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="user-cell">
                          <span className={`avatar ring-${meta.tone}`}>{initials(user.nombre)}</span>
                          <div className="user-cell-text">
                            <b>
                              {user.nombre}
                              {isSelf && <span className="badge-muted user-you-badge">Tú</span>}
                            </b>
                            <small>@{user.usuario}{user.email ? ` · ${user.email}` : ''}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${user.rol}`}>
                          {roleLabels[user.rol] || user.rol}
                        </span>
                      </td>
                      <td>
                        <span className={`user-status ${user.activo ? 'active' : 'inactive'}`}>
                          <i />{user.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <span className={user.ultimo_acceso_at ? '' : 'texto-muted-soft'}>
                          {user.ultimo_acceso_at || 'Nunca'}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <div className="actions-row">
                          <button className="icon-btn" title="Ver detalle" onClick={() => setViewingUser(user)}>
                            <IconEye />
                          </button>
                          <button className="icon-btn" title="Editar" onClick={() => startEdit(user)}>
                            <IconEdit />
                          </button>
                          <button className="icon-btn" title="Restablecer contraseña" onClick={() => startReset(user)}>
                            <IconKey />
                          </button>
                          <button
                            className="icon-btn danger"
                            title={user.activo ? 'Desactivar' : 'Activar'}
                            onClick={() => toggleActive(user)}
                            disabled={isSelf && user.activo}
                          >
                            <IconPower />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredItems.length} onPageChange={setPage} />
      </div>

      {viewingUser && (
        <Modal
          title="Detalle del usuario"
          icon={<IconUser />}
          onClose={() => setViewingUser(null)}
          width={420}
          footer={<button className="btn-outline" onClick={() => setViewingUser(null)}>Cerrar</button>}
        >
          <div className="profile-info">
            <span className={`avatar ring-${(roleMeta[viewingUser.rol] || {}).tone || 'blue'}`} style={{ width: 56, height: 56, fontSize: 20 }}>
              {initials(viewingUser.nombre)}
            </span>
            <h3 style={{ margin: '12px 0 2px' }}>{viewingUser.nombre}</h3>
            <p style={{ margin: 0, color: 'var(--color-muted)' }}>@{viewingUser.usuario}</p>
            <span className={`role-badge ${viewingUser.rol}`} style={{ marginTop: 10 }}>
              {roleLabels[viewingUser.rol] || viewingUser.rol}
            </span>
          </div>
          <div className="detail-list">
            <div>
              <span><IconMail width={14} height={14} /> Correo</span>
              <strong>{viewingUser.email || 'Sin correo'}</strong>
            </div>
            <div>
              <span><IconPhone width={14} height={14} /> Teléfono</span>
              <strong>{viewingUser.telefono || 'Sin teléfono'}</strong>
            </div>
            <div>
              <span><IconPower width={14} height={14} /> Estado</span>
              <strong>
                <span className={`user-status ${viewingUser.activo ? 'active' : 'inactive'}`}>
                  <i />{viewingUser.activo ? 'Activo' : 'Inactivo'}
                </span>
              </strong>
            </div>
            <div>
              <span><IconCalendar width={14} height={14} /> Último acceso</span>
              <strong>{viewingUser.ultimo_acceso_at || 'Nunca'}</strong>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
