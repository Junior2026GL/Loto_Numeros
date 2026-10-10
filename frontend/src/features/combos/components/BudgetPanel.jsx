import { useEffect, useState } from 'react';
import { useToast } from '../../../components/ToastProvider.jsx';
import { IconAlert, IconCalendar, IconSave } from '../../../components/icons.jsx';
import { getBudget, saveMonthlyLimit } from '../services/combos.service.js';
import { formatMoney } from '../../../utils/money.js';

/** Control de gasto: cuánto llevas gastado y ganado, con un límite mensual opcional. */
export default function BudgetPanel({ reload }) {
  const toast = useToast();
  const [budget, setBudget] = useState(null);
  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getBudget()
      .then((data) => {
        setBudget(data);
        setLimit(data.limiteMensual === null ? '' : String(data.limiteMensual));
      })
      .catch((err) => setError(err.response?.data?.message || 'No se pudo cargar el presupuesto'));
  }, [reload]);

  async function save(value) {
    setSaving(true);
    setError('');
    try {
      const data = await saveMonthlyLimit(value);
      setBudget(data);
      setLimit(data.limiteMensual === null ? '' : String(data.limiteMensual));
      toast.success(value === null ? 'Límite quitado.' : 'Límite mensual guardado.');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el límite');
    } finally {
      setSaving(false);
    }
  }

  if (!budget) {
    return (
      <div className="panel">
        {error ? <div className="alert error">{error}</div> : <div className="table-loading"><div className="table-loading-row" /></div>}
      </div>
    );
  }

  const { mes, total, limiteMensual } = budget;
  const used = limiteMensual ? Math.min(100, (mes.gastado / limiteMensual) * 100) : 0;
  const over = limiteMensual !== null && mes.gastado > limiteMensual;
  const near = limiteMensual !== null && !over && used >= 80;

  return (
    <>
      <div className="card-grid">
        <div className="stat-card amber">
          <div className="stat-card-icon amber"><IconCalendar /></div>
          <span>Gastado este mes</span>
          <strong className="stat-text">{formatMoney(mes.gastado)}</strong>
          <small className="stat-hint">{mes.jugadas} combinación{mes.jugadas === 1 ? '' : 'es'} jugada{mes.jugadas === 1 ? '' : 's'}</small>
        </div>
        <div className="stat-card green">
          <div className="stat-card-icon green"><IconSave /></div>
          <span>Ganado en total</span>
          <strong className="stat-text">{formatMoney(total.ganado)}</strong>
          <small className="stat-hint">gastado en total: {formatMoney(total.gastado)}</small>
        </div>
        <div className={`stat-card ${total.saldo >= 0 ? 'blue' : 'red'}`}>
          <div className={`stat-card-icon ${total.saldo >= 0 ? 'blue' : 'red'}`}><IconAlert /></div>
          <span>Saldo total</span>
          <strong className="stat-text">{formatMoney(total.saldo)}</strong>
          <small className="stat-hint">{total.saldo >= 0 ? 'ganado menos gastado' : 'has gastado más de lo que ganaste'}</small>
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Límite mensual de gasto</h3>
        <p className="panel-note">
          Fija cuánto estás dispuesto a gastar por mes. Si una combinación te hace pasar el límite, el sistema te
          lo avisa y te pide confirmar antes de marcarla como jugada.
        </p>

        {limiteMensual !== null && (
          <div className="budget-meter">
            <div className="budget-meter-head">
              <span>{formatMoney(mes.gastado)} de {formatMoney(limiteMensual)}</span>
              <b className={over ? 'money-neg' : ''}>
                {over ? `Te pasaste por ${formatMoney(mes.gastado - limiteMensual)}` : `Te quedan ${formatMoney(mes.restante)}`}
              </b>
            </div>
            <div className="progress-track">
              <div className={`progress-fill ${over ? 'over' : near ? 'near' : ''}`} style={{ width: `${over ? 100 : used}%` }} />
            </div>
          </div>
        )}

        {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="limit-form">
          <div>
            <label>Límite por mes (L)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={limit}
              placeholder="Sin límite"
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={saving || limit === ''} onClick={() => save(Number(limit))}>
            {saving ? 'Guardando…' : 'Guardar límite'}
          </button>
          {limiteMensual !== null && (
            <button className="btn-outline" disabled={saving} onClick={() => save(null)}>Quitar límite</button>
          )}
        </div>

        <p className="panel-note" style={{ margin: '14px 0 0' }}>
          Precio de un boleto: <b>{formatMoney(budget.precioBoleto)}</b> (lo define el administrador en Configuración).
          Cada combinación que marcas como jugada suma ese precio a tu gasto; los premios los registras tú en
          «Mis combinaciones».
        </p>
      </div>
    </>
  );
}
