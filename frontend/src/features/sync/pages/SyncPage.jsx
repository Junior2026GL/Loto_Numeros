import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader.jsx';
import Pagination from '../../../components/Pagination.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { IconDownload, IconClock } from '../../../components/icons.jsx';
import { getSyncStatus, listSyncRuns, runSync } from '../services/sync.service.js';
import { formatDate } from '../../../utils/dates.js';

const PAGE_SIZE = 10;
const STATE_LABELS = { COMPLETADA: 'Completada', FALLIDA: 'Fallida', EN_CURSO: 'En curso' };
const STATE_TONES = { COMPLETADA: 'sent', FALLIDA: 'failed', EN_CURSO: '' };

function formatDateTime(value) {
  if (!value) return '—';
  const [date, time] = String(value).split(' ');
  return `${formatDate(date)} ${time?.slice(0, 5) || ''}`;
}

export default function SyncPage() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [range, setRange] = useState({ desde: '', hasta: '' });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    getSyncStatus()
      .then((s) => {
        setStatus(s);
        setRange((current) => (current.desde ? current : s.sugerido));
      })
      .catch((err) => setError(err.response?.data?.message || 'No se pudo cargar el estado'));
  }, [reload]);

  useEffect(() => {
    listSyncRuns({ page, pageSize: PAGE_SIZE })
      .then(setRuns)
      .catch(() => {});
  }, [page, reload]);

  async function submit(e) {
    e.preventDefault();
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const data = await runSync(range);
      setResult(data);
      if (data.insertados > 0) toast.success(`${data.insertados} sorteo(s) nuevo(s) guardado(s).`);
      else toast.success('Sincronización terminada: no había sorteos nuevos.');
      setPage(1);
      setRange((current) => ({ ...current })); // mantiene el rango elegido
      setReload((n) => n + 1);
    } catch (err) {
      const message = err.response?.data?.message || 'No se pudo completar la sincronización';
      setError(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Sincronización"
        description="Descarga los resultados oficiales desde loto.hn y los guarda en el historial."
      />

      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="panel">
        <h3 className="panel-title">Actualizar resultados</h3>

        <p className="sync-hint">
          {status?.ultimoSorteo
            ? <>Último sorteo guardado: <strong>{formatDate(status.ultimoSorteo)}</strong>. </>
            : 'Aún no hay sorteos guardados. '}
          Solo se descargan los sorteos que faltan; los que ya existen no se tocan.
          {status && (
            <> La sincronización automática está <strong>{status.autoSync ? 'activada' : 'desactivada'}</strong>.</>
          )}
        </p>

        <form className="sync-form" onSubmit={submit}>
          <div>
            <label>Desde</label>
            <input
              type="date"
              value={range.desde}
              onChange={(e) => setRange({ ...range, desde: e.target.value })}
              required
            />
          </div>
          <div>
            <label>Hasta</label>
            <input
              type="date"
              value={range.hasta}
              onChange={(e) => setRange({ ...range, hasta: e.target.value })}
              required
            />
          </div>
          <button className="btn-primary" disabled={running || !range.desde || !range.hasta}>
            <IconDownload /> {running ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        </form>

        {running && (
          <div className="alert" style={{ marginTop: 16 }}>
            <IconClock width={16} height={16} /> Consultando loto.hn, esto puede tardar unos segundos…
          </div>
        )}

        {result && (
          <div className="sync-result">
            <div><strong>{result.insertados}</strong><span>Nuevos</span></div>
            <div><strong>{result.omitidos}</strong><span>Omitidos</span></div>
            <div><strong>{result.errores}</strong><span>Errores</span></div>
            <div><strong>{result.totalFechas}</strong><span>Fechas revisadas</span></div>
          </div>
        )}
        {result?.detalle?.length > 0 && (
          <pre className="sync-detail">{result.detalle.join('\n')}</pre>
        )}
      </div>

      <div className="panel table-wrap">
        <h3 className="panel-title">Historial de sincronizaciones</h3>

        {runs.items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Aún no se ha ejecutado ninguna sincronización</div>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Rango</th>
                  <th>Nuevos</th>
                  <th>Omitidos</th>
                  <th>Errores</th>
                  <th>Estado</th>
                  <th>Origen</th>
                </tr>
              </thead>
              <tbody>
                {runs.items.map((run) => (
                  <tr key={run.id} title={run.detalle || undefined}>
                    <td>{formatDateTime(run.iniciada_at)}</td>
                    <td>{formatDate(run.fecha_desde)} – {formatDate(run.fecha_hasta)}</td>
                    <td>{run.insertados}</td>
                    <td>{run.omitidos}</td>
                    <td>{run.errores}</td>
                    <td><span className={`status ${STATE_TONES[run.estado]}`}>{STATE_LABELS[run.estado] || run.estado}</span></td>
                    <td>
                      {run.origen === 'PROGRAMADA' ? 'Automática' : (run.usuario_nombre || 'Manual')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={runs.total} onPageChange={setPage} />
          </>
        )}
      </div>
    </>
  );
}
