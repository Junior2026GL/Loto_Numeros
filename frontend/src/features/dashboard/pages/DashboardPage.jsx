import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader.jsx';
import { BallsRow } from '../../../components/LotteryBall.jsx';
import LotteryBall from '../../../components/LotteryBall.jsx';
import { IconAlert, IconCalendar, IconClock, IconLogbook, IconArrowRight } from '../../../components/icons.jsx';
import { getSummary } from '../../draws/services/draws.service.js';
import { getSyncStatus } from '../../sync/services/sync.service.js';
import { getUser } from '../../auth/session.js';
import { capitalize, dayName, formatDate } from '../../../utils/dates.js';

export default function DashboardPage() {
  const user = getUser();
  const isAdmin = user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN';
  const [data, setData] = useState(null);
  const [sync, setSync] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getSummary()
      .then(setData)
      .catch((err) => setError(err.response?.data?.message || 'No se pudo cargar el resumen'));
    if (isAdmin) getSyncStatus().then(setSync).catch(() => {});
  }, [isAdmin]);

  const firstName = user?.nombre?.split(' ')[0];
  const lastRunFailed = sync?.ultimaEjecucion?.estado === 'FALLIDA';

  return (
    <>
      <PageHeader
        title={`Hola${firstName ? `, ${firstName}` : ''}`}
        description={data ? data.juego.nombre : 'Resultados y estadísticas del sorteo.'}
      />

      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

      {isAdmin && lastRunFailed && (
        <div className="alert error dash-notice">
          <IconAlert width={17} height={17} />
          <span>
            <b>La última sincronización con loto.hn falló.</b>{' '}
            {sync.ultimaEjecucion.detalle?.split('\n')[0]}{' '}
            <Link to="/sincronizacion">Revisar</Link>
          </span>
        </div>
      )}

      {data?.pendientes > 0 && (
        <div className="alert dash-notice">
          <IconAlert width={17} height={17} />
          <span>
            Faltan <b>{data.pendientes}</b> sorteo{data.pendientes === 1 ? '' : 's'} por guardar: los resultados
            que ves pueden no estar al día.{' '}
            {isAdmin && <Link to="/sincronizacion">Sincronizar ahora</Link>}
          </span>
        </div>
      )}

      <div className="card-grid">
        <div className="stat-card blue">
          <div className="stat-card-icon blue"><IconLogbook /></div>
          <span>Sorteos registrados</span>
          <strong>{data ? data.total : '—'}</strong>
        </div>

        <div className="stat-card amber">
          <div className="stat-card-icon amber"><IconCalendar /></div>
          <span>Próximo sorteo</span>
          <strong className="stat-text">
            {data?.proximo
              ? `${capitalize(dayName(data.proximo.dia_semana))} ${formatDate(data.proximo.fecha)}`
              : '—'}
          </strong>
          {data?.proximo && <small className="stat-hint"><IconClock width={13} height={13} /> {data.proximo.hora}</small>}
        </div>

        <div className="stat-card green">
          <div className="stat-card-icon green"><IconLogbook /></div>
          <span>Número más frecuente</span>
          <strong>
            {data?.masFrecuente ? <LotteryBall number={data.masFrecuente.numero} size="sm" /> : '—'}
          </strong>
          {data?.masFrecuente && <small className="stat-hint">{data.masFrecuente.veces} veces</small>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head-row">
          <h3 className="panel-title" style={{ margin: 0 }}>Último sorteo</h3>
          <Link to="/sorteos" className="btn-link">Ver historial <IconArrowRight width={14} height={14} /></Link>
        </div>

        {!data ? (
          <div className="table-loading"><div className="table-loading-row" /></div>
        ) : data.ultimo ? (
          <div className="last-draw">
            <div className="last-draw-date">
              <strong>{capitalize(dayName(data.ultimo.dia_semana))}</strong>
              <span>{formatDate(data.ultimo.fecha)}</span>
            </div>
            <BallsRow numbers={data.ultimo.numeros} size="lg" />
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-title">Aún no hay sorteos registrados</div>
          </div>
        )}
      </div>
    </>
  );
}
