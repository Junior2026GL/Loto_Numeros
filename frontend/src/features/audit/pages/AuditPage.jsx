import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../components/PageHeader.jsx';
import Pagination from '../../../components/Pagination.jsx';
import {
  IconSearch,
  IconUser,
  IconUsers,
  IconAlert,
  IconKey,
  IconLock,
  IconPlus,
  IconEdit,
  IconPower,
  IconTrash,
  IconDownload,
  IconCalendar,
  IconShield,
  IconClock,
  IconLogbook,
} from '../../../components/icons.jsx';
import { listAudit, getAuditStats } from '../services/audit.service.js';

const PAGE_SIZE = 20;

const moduloLabels = {
  AUTENTICACION: 'Autenticación',
  USUARIOS: 'Usuarios',
  SORTEOS: 'Sorteos',
};

const moduloTones = {
  AUTENTICACION: 'gray',
  USUARIOS: 'blue',
  SORTEOS: 'amber',
};

const moduloIcons = {
  AUTENTICACION: IconShield,
  USUARIOS: IconUsers,
  SORTEOS: IconCalendar,
};

const accionLabels = {
  LOGIN: 'Inicio de sesión',
  LOGIN_FALLIDO: 'Inicio fallido',
  CAMBIO_PASSWORD: 'Cambio de contraseña',
  CREAR: 'Creación',
  ACTUALIZAR: 'Actualización',
  ACTIVAR: 'Activación',
  DESACTIVAR: 'Desactivación',
  RESET_PASSWORD: 'Restablecer contraseña',
  ELIMINAR: 'Eliminación',
  SINCRONIZAR: 'Sincronización',
};

const accionTones = {
  LOGIN: 'green',
  LOGIN_FALLIDO: 'red',
  CAMBIO_PASSWORD: 'purple',
  CREAR: 'blue',
  ACTUALIZAR: 'amber',
  ACTIVAR: 'green',
  DESACTIVAR: 'red',
  RESET_PASSWORD: 'purple',
  ELIMINAR: 'red',
  SINCRONIZAR: 'blue',
};

const accionIcons = {
  LOGIN: IconUser,
  LOGIN_FALLIDO: IconAlert,
  CAMBIO_PASSWORD: IconKey,
  CREAR: IconPlus,
  ACTUALIZAR: IconEdit,
  ACTIVAR: IconPower,
  DESACTIVAR: IconPower,
  RESET_PASSWORD: IconLock,
  ELIMINAR: IconTrash,
  SINCRONIZAR: IconDownload,
};

// Debe coincidir con ACCIONES_ALERTA del backend (audit.repository.js).
const ACCIONES_ALERTA = new Set(['LOGIN_FALLIDO', 'DESACTIVAR']);

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function parseFecha(valor) {
  return new Date(String(valor).replace(' ', 'T'));
}

function toDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatHora(valor) {
  if (!valor) return '-';
  return parseFecha(valor).toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' });
}

function diaClave(valor) {
  return valor ? toDateInput(parseFecha(valor)) : 'sin-fecha';
}

function diaEtiqueta(clave) {
  if (clave === 'sin-fecha') return 'Sin fecha';

  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);

  if (clave === toDateInput(hoy)) return 'Hoy';
  if (clave === toDateInput(ayer)) return 'Ayer';

  const [y, m, d] = clave.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-HN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function rangoRapido(dias) {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - (dias - 1));
  return { desde: toDateInput(desde), hasta: toDateInput(hasta) };
}

function formatNumero(valor) {
  return Number(valor || 0).toLocaleString('es-HN');
}

export default function AuditPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  const [search, setSearch] = useState('');
  const [modulo, setModulo] = useState('TODOS');
  const [accion, setAccion] = useState('TODOS');
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [verFechas, setVerFechas] = useState(false);
  const [page, setPage] = useState(1);

  const hoyRango = rangoRapido(1);
  const semanaRango = rangoRapido(7);
  const esTodo = !desde && !hasta;
  const esHoy = desde === hoyRango.desde && hasta === hoyRango.hasta;
  const esSemana = desde === semanaRango.desde && hasta === semanaRango.hasta;

  const hayFiltros = search || modulo !== 'TODOS' || accion !== 'TODOS' || soloAlertas || desde || hasta;

  useEffect(() => {
    getAuditStats({ hoy: hoyRango.desde, desdeSemana: semanaRango.desde })
      .then(setStats)
      .catch(console.error);
  }, [recarga]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      listAudit({
        q: search || undefined,
        modulo: modulo !== 'TODOS' ? modulo : undefined,
        accion: accion !== 'TODOS' ? accion : undefined,
        soloAlertas: soloAlertas ? '1' : undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
        .then((data) => {
          setItems(data.items);
          setTotal(data.total);
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'No se pudo cargar la bitácora');
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [search, modulo, accion, soloAlertas, desde, hasta, page, recarga]);

  useEffect(() => {
    setPage(1);
  }, [search, modulo, accion, soloAlertas, desde, hasta]);

  function limpiarFiltros() {
    setSearch('');
    setModulo('TODOS');
    setAccion('TODOS');
    setSoloAlertas(false);
    setDesde('');
    setHasta('');
  }

  function aplicarRango(rango) {
    setDesde(rango?.desde || '');
    setHasta(rango?.hasta || '');
  }

  const grupos = useMemo(() => {
    const porDia = new Map();
    for (const item of items) {
      const clave = diaClave(item.created_at);
      if (!porDia.has(clave)) porDia.set(clave, []);
      porDia.get(clave).push(item);
    }
    return [...porDia.entries()].map(([clave, eventos]) => ({
      clave,
      etiqueta: diaEtiqueta(clave),
      eventos,
    }));
  }, [items]);

  const resumen = [
    { label: 'Eventos totales', value: stats?.total, Icon: IconLogbook, tone: 'blue', onClick: limpiarFiltros },
    { label: 'Hoy', value: stats?.hoy, Icon: IconClock, tone: 'green', onClick: () => aplicarRango(hoyRango) },
    {
      label: 'Alertas (7 días)',
      value: stats?.alertas,
      Icon: IconAlert,
      tone: 'red',
      onClick: () => { setSoloAlertas(true); aplicarRango(semanaRango); },
    },
  ];

  return (
    <>
      <PageHeader
        title="Bitácora"
        description="Registro de auditoría de acciones sensibles del sistema."
        actions={
          <button
            type="button"
            className="btn-outline"
            onClick={() => setRecarga((n) => n + 1)}
            disabled={loading}
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        }
      />

      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="audit-content">
        <div className="audit-kpis">
          {resumen.map(({ label, value, Icon, tone, onClick }) => (
            <button type="button" className="audit-kpi" key={label} onClick={onClick} title="Filtrar por esto">
              <span className={`audit-kpi-icon ${tone}`}><Icon width={20} height={20} /></span>
              <span>
                <small>{label}</small>
                <strong>{stats ? formatNumero(value) : '—'}</strong>
              </span>
            </button>
          ))}
        </div>

        <div className="audit-bar">
          <div className="input-icon audit-filter-search">
            <IconSearch />
            <input
              placeholder="Buscar por usuario, descripción o IP…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="audit-pills">
            <button type="button" className={`audit-pill ${esTodo ? 'active' : ''}`} onClick={() => aplicarRango(null)}>
              Todo
            </button>
            <button type="button" className={`audit-pill ${esHoy ? 'active' : ''}`} onClick={() => aplicarRango(hoyRango)}>
              Hoy
            </button>
            <button type="button" className={`audit-pill ${esSemana ? 'active' : ''}`} onClick={() => aplicarRango(semanaRango)}>
              7 días
            </button>
            <button
              type="button"
              className={`audit-pill ${verFechas || (!esTodo && !esHoy && !esSemana) ? 'active' : ''}`}
              onClick={() => setVerFechas((v) => !v)}
            >
              Fechas…
            </button>
            <button
              type="button"
              className={`audit-pill danger ${soloAlertas ? 'active' : ''}`}
              onClick={() => setSoloAlertas((v) => !v)}
            >
              <IconAlert width={14} height={14} /> Solo alertas
            </button>
          </div>

          <select value={modulo} onChange={(e) => setModulo(e.target.value)} aria-label="Módulo">
            <option value="TODOS">Todos los módulos</option>
            {Object.entries(moduloLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select value={accion} onChange={(e) => setAccion(e.target.value)} aria-label="Acción">
            <option value="TODOS">Todas las acciones</option>
            {Object.entries(accionLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {(verFechas || (!esTodo && !esHoy && !esSemana)) && (
            <div className="audit-dates">
              <label>
                <span>Desde</span>
                <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
              </label>
              <label>
                <span>Hasta</span>
                <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
              </label>
            </div>
          )}
        </div>

        <div className="audit-result-line">
          <span>
            {formatNumero(total)} evento{total === 1 ? '' : 's'}
            {hayFiltros && ' con los filtros actuales'}
          </span>
          {hayFiltros && (
            <button type="button" className="btn-link" onClick={limpiarFiltros}>Limpiar filtros</button>
          )}
        </div>

        {loading && items.length === 0 ? (
          <div className="table-loading">
            {[0, 1, 2, 3].map((i) => <div className="table-loading-row" key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="panel">
            <div className="empty-state">
              <span className="empty-state-icon">🗒️</span>
              <div className="empty-state-title">
                {hayFiltros ? 'Sin resultados para tu búsqueda' : 'Sin eventos registrados todavía'}
              </div>
              <p>
                {hayFiltros
                  ? 'Intenta con otro usuario, módulo, acción o rango de fechas.'
                  : 'Las acciones sensibles del sistema aparecerán aquí a medida que ocurran.'}
              </p>
            </div>
          </div>
        ) : (
          <div className={`audit-feed ${loading ? 'is-refreshing' : ''}`}>
            {grupos.map((grupo) => (
              <section key={grupo.clave}>
                <div className="audit-day">
                  <b>{grupo.etiqueta}</b>
                  <span>
                    {grupo.eventos.length} evento{grupo.eventos.length === 1 ? '' : 's'} en esta página
                  </span>
                </div>

                <div className="audit-timeline">
                  {grupo.eventos.map((item) => {
                    const AccionIcon = accionIcons[item.accion] || IconLogbook;
                    const ModuloIcon = moduloIcons[item.modulo];
                    const alerta = ACCIONES_ALERTA.has(item.accion);

                    return (
                      <div className="audit-event" key={item.id}>
                        <span className={`audit-node ${accionTones[item.accion] || 'gray'}`}>
                          <AccionIcon width={18} height={18} />
                        </span>

                        <article className={`audit-card ${alerta ? 'alert' : ''}`}>
                          <header>
                            <strong>{accionLabels[item.accion] || item.accion}</strong>
                            <span className={`audit-tag ${moduloTones[item.modulo] || 'gray'}`}>
                              {ModuloIcon && <ModuloIcon width={13} height={13} />}
                              {moduloLabels[item.modulo] || item.modulo}
                            </span>
                            <time>
                              <IconClock width={13} height={13} /> {formatHora(item.created_at)}
                            </time>
                          </header>

                          <p>{item.descripcion || 'Sin descripción'}</p>

                          <footer>
                            {item.usuario_id ? (
                              <span className="audit-user">
                                <span className="avatar sm">{initials(item.usuario_nombre)}</span>
                                {item.usuario_nombre || '-'}
                              </span>
                            ) : (
                              <span className="texto-muted-soft">Sistema</span>
                            )}
                            {item.ip && <span className="audit-ip">IP {item.ip}</span>}
                          </footer>
                        </article>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </>
  );
}
