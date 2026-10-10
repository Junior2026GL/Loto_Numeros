import { useState } from 'react';
import { BallsRow } from '../../../components/LotteryBall.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { IconCheck, IconChart, IconSave } from '../../../components/icons.jsx';
import NumberGrid from './NumberGrid.jsx';
import SimulateModal from './SimulateModal.jsx';
import { generateCombinations, saveCombination } from '../services/combos.service.js';
import { capitalize, dayName, formatDate } from '../../../utils/dates.js';

const MAX_FIXED = 5;
const keyOf = (code, numbers) => `${code}:${numbers.join('-')}`;

export default function GeneratorPanel({ nextDraw, onNextDraw, onSaved }) {
  const toast = useToast();
  const [fixed, setFixed] = useState(new Set());
  const [excluded, setExcluded] = useState(new Set());
  const [balanced, setBalanced] = useState(false);
  const [amount, setAmount] = useState(1);

  const [generated, setGenerated] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(new Set());
  const [savingKey, setSavingKey] = useState('');
  const [simulating, setSimulating] = useState(null);

  // Cada toque cambia el estado del número: normal -> fijo -> excluido -> normal.
  function cycle(n) {
    const next = (set, add) => {
      const copy = new Set(set);
      if (add) copy.add(n); else copy.delete(n);
      return copy;
    };
    if (fixed.has(n)) {
      setFixed(next(fixed, false));
      setExcluded(next(excluded, true));
    } else if (excluded.has(n)) {
      setExcluded(next(excluded, false));
    } else if (fixed.size < MAX_FIXED) {
      setFixed(next(fixed, true));
    } else {
      setExcluded(next(excluded, true)); // ya hay 5 fijos: este pasa directo a excluido
    }
  }

  const stateOf = (n) => (fixed.has(n) ? 'fixed' : excluded.has(n) ? 'excluded' : '');
  const asList = (set) => [...set].sort((a, b) => a - b);

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      const data = await generateCombinations({
        fijos: asList(fixed),
        excluidos: asList(excluded),
        equilibrada: balanced,
        cantidad: amount,
      });
      setGenerated(data);
      onNextDraw(data.proximoSorteo);
      setSaved(new Set());
      data.advertencias.forEach((message) => toast.error(message));
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron generar las combinaciones');
    } finally {
      setGenerating(false);
    }
  }

  async function saveOne(code, numbers) {
    const key = keyOf(code, numbers);
    setSavingKey(key);
    try {
      await saveCombination({ estrategia: code, numeros: numbers, fecha: nextDraw?.fecha });
      setSaved((current) => new Set(current).add(key));
      onSaved();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar la combinación');
      return false;
    } finally {
      setSavingKey('');
    }
  }

  async function saveAll() {
    let count = 0;
    for (const strategy of generated.estrategias) {
      for (const combo of strategy.combinaciones) {
        if (saved.has(keyOf(strategy.codigo, combo))) continue;
        if (await saveOne(strategy.codigo, combo)) count += 1;
      }
    }
    if (count > 0) toast.success(`${count} combinación${count === 1 ? '' : 'es'} guardada${count === 1 ? '' : 's'}.`);
  }

  const total = generated ? generated.estrategias.reduce((acc, s) => acc + s.combinaciones.length, 0) : 0;
  const pending = generated ? total - saved.size : 0;

  return (
    <>
      <div className="panel">
        <h3 className="panel-title">Opciones</h3>
        <p className="panel-note">
          Toca un número para <b>fijarlo</b> (saldrá en todas las combinaciones), vuelve a tocarlo para
          <b> excluirlo</b> (nunca saldrá) y otra vez para quitarlo. Puedes fijar hasta {MAX_FIXED}.
        </p>

        <NumberGrid stateOf={stateOf} onPick={cycle} />

        <div className="legend">
          <span><i className="dot gold" /> Fijo</span>
          <span><i className="dot red" /> Excluido</span>
          <span><i className="dot plain" /> Libre</span>
          {(fixed.size > 0 || excluded.size > 0) && (
            <button type="button" className="btn-link" onClick={() => { setFixed(new Set()); setExcluded(new Set()); }}>
              Limpiar selección
            </button>
          )}
        </div>

        <div className="options-row">
          <label className="check-row">
            <input type="checkbox" checked={balanced} onChange={(e) => setBalanced(e.target.checked)} />
            <span>
              <b>Combinaciones equilibradas</b>
              <small>Evita patrones raros: rachas de consecutivos, todos pares o impares, progresiones y sumas extremas.</small>
            </span>
          </label>

          <div>
            <label>Combinaciones por estrategia</label>
            <select value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ maxWidth: 140 }}>
              {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="alert error" style={{ marginTop: 14 }}>{error}</div>}

        <div className="panel-actions" style={{ marginTop: 16 }}>
          <button className="btn-primary" onClick={generate} disabled={generating}>
            {generating ? 'Generando…' : generated ? 'Generar de nuevo' : 'Generar combinaciones'}
          </button>
          {generated && (
            <button className="btn-outline" onClick={saveAll} disabled={pending === 0 || Boolean(savingKey)}>
              <IconSave /> {pending === 0 ? 'Todas guardadas' : `Guardar las ${pending} pendientes`}
            </button>
          )}
        </div>
      </div>

      {generated && (
        <div className="panel">
          <div className="panel-head-row">
            <div>
              <h3 className="panel-title" style={{ margin: 0 }}>Resultado</h3>
              {nextDraw && (
                <p className="panel-note" style={{ margin: '4px 0 0' }}>
                  Para el sorteo del <b>{capitalize(dayName(nextDraw.dia_semana))} {formatDate(nextDraw.fecha)}</b> a
                  las {nextDraw.hora}. Basado en {generated.sorteosAnalizados} sorteos.
                </p>
              )}
            </div>
          </div>

          <div className="combo-grid">
            {generated.estrategias.map((strategy) => (
              <div className="combo-card" key={strategy.codigo}>
                <strong>{strategy.nombre}</strong>
                <p className="combo-desc">{strategy.descripcion}</p>

                {strategy.combinaciones.map((combo) => {
                  const key = keyOf(strategy.codigo, combo);
                  const isSaved = saved.has(key);
                  return (
                    <div className="combo-line" key={key}>
                      <BallsRow numbers={combo} size="md" />
                      <div className="combo-line-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="¿Cómo le habría ido?"
                          aria-label="¿Cómo le habría ido?"
                          onClick={() => setSimulating(combo)}
                        >
                          <IconChart />
                        </button>
                        <button
                          className={isSaved ? 'btn-outline' : 'btn-primary'}
                          style={{ padding: '6px 12px', fontSize: 13 }}
                          onClick={() => saveOne(strategy.codigo, combo)}
                          disabled={isSaved || savingKey === key}
                        >
                          {isSaved ? <><IconCheck width={14} height={14} /> Guardada</> : <><IconSave width={14} height={14} /> Guardar</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {simulating && <SimulateModal numbers={simulating} onClose={() => setSimulating(null)} />}
    </>
  );
}
