import { useState } from 'react';
import { BallsRow } from '../../../components/LotteryBall.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { IconAlert, IconSave } from '../../../components/icons.jsx';
import NumberGrid from './NumberGrid.jsx';
import { buildWheel, saveCombination } from '../services/combos.service.js';
import { formatMoney, formatPercent } from '../../../utils/money.js';

const PICK = 6;
const MIN_GROUP = PICK + 1;
const MAX_GROUP = 12;

/** Sistema de cobertura: reparte un grupo de números en varios boletos con una garantía de aciertos. */
export default function WheelPanel({ nextDraw, onSaved }) {
  const toast = useToast();
  const [group, setGroup] = useState(new Set());
  const [guarantee, setGuarantee] = useState(3);
  const [wheel, setWheel] = useState(null);
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggle(n) {
    setWheel(null);
    setGroup((current) => {
      const copy = new Set(current);
      if (copy.has(n)) copy.delete(n);
      else if (copy.size < MAX_GROUP) copy.add(n);
      return copy;
    });
  }

  async function build() {
    setBuilding(true);
    setError('');
    try {
      setWheel(await buildWheel({ grupo: [...group].sort((a, b) => a - b), garantia: guarantee }));
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo armar la cobertura');
    } finally {
      setBuilding(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    let count = 0;
    try {
      for (const ticket of wheel.combinaciones) {
        await saveCombination({ estrategia: 'MANUAL', numeros: ticket, fecha: nextDraw?.fecha });
        count += 1;
      }
      toast.success(`${count} boletos guardados.`);
    } catch (err) {
      toast.error(err.response?.data?.message || `Se guardaron ${count} boletos y luego hubo un error`);
    } finally {
      setSaving(false);
      if (count > 0) onSaved();
    }
  }

  const ready = group.size >= MIN_GROUP;

  return (
    <>
      <div className="panel">
        <h3 className="panel-title">Sistema de cobertura</h3>
        <p className="panel-note">
          Elige entre {MIN_GROUP} y {MAX_GROUP} números. El sistema los reparte en varios boletos para que, <b>si en
          el sorteo salen al menos X de tus números</b>, uno de los boletos tenga X aciertos o más (un premio menor
          asegurado).
        </p>

        <NumberGrid stateOf={(n) => (group.has(n) ? 'selected' : '')} onPick={toggle} />

        <div className="legend">
          <span><b>{group.size}</b> elegidos {group.size > 0 && <>({[...group].sort((a, b) => a - b).map((n) => String(n).padStart(2, '0')).join(' ')})</>}</span>
          {group.size > 0 && <button type="button" className="btn-link" onClick={() => { setGroup(new Set()); setWheel(null); }}>Limpiar</button>}
        </div>

        <div className="options-row">
          <div>
            <label>Quiero garantizar</label>
            <select value={guarantee} onChange={(e) => { setGuarantee(Number(e.target.value)); setWheel(null); }} style={{ maxWidth: 220 }}>
              {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} aciertos</option>)}
            </select>
          </div>
        </div>

        {error && <div className="alert error" style={{ marginTop: 14 }}>{error}</div>}

        <div style={{ marginTop: 16 }}>
          <button className="btn-primary" onClick={build} disabled={!ready || building}>
            {building ? 'Calculando…' : 'Armar cobertura'}
          </button>
          {!ready && <span className="panel-note" style={{ marginLeft: 12 }}>Elige al menos {MIN_GROUP} números.</span>}
        </div>
      </div>

      {wheel && (
        <div className="panel">
          <div className="sync-result" style={{ marginTop: 0 }}>
            <div><strong>{wheel.totalBoletos}</strong><span>Boletos necesarios</span></div>
            <div><strong>{formatMoney(wheel.costoTotal)}</strong><span>Costo total sencillo ({formatMoney(wheel.precioBoleto)} c/u)</span></div>
            <div><strong>{formatMoney(wheel.costoTotalDoble)}</strong><span>Costo total doble ({formatMoney(wheel.precioDoble)} c/u)</span></div>
            <div><strong>{formatPercent(wheel.probabilidadActivacion)}</strong><span>Prob. de que se active la garantía</span></div>
          </div>

          <div className="alert" style={{ margin: '14px 0' }}>
            <IconAlert width={17} height={17} />
            <span>
              Esto <b>no aumenta la probabilidad</b> de que tus números salgan: solo reparte tu dinero en varios boletos.
              La garantía de {wheel.garantia} aciertos solo se activa si en el sorteo salen al menos {wheel.garantia} de tus
              {' '}{wheel.grupo.length} números, y eso ocurre con una probabilidad de {formatPercent(wheel.probabilidadActivacion)}.
              Jugar los {wheel.totalBoletos} boletos cuesta {formatMoney(wheel.costoTotal)} en sencilla o {formatMoney(wheel.costoTotalDoble)} en doble.
            </span>
          </div>

          <div className="wheel-list">
            {wheel.combinaciones.map((ticket) => (
              <div className="wheel-ticket" key={ticket.join('-')}>
                <BallsRow numbers={ticket} size="sm" />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <button className="btn-outline" onClick={saveAll} disabled={saving}>
              <IconSave /> {saving ? 'Guardando…' : `Guardar los ${wheel.totalBoletos} boletos`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
