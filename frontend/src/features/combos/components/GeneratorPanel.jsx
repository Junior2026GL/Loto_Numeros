import { useState } from 'react';
import { BallsRow } from '../../../components/LotteryBall.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { IconCheck, IconChart, IconChevronDown, IconSave } from '../../../components/icons.jsx';
import NumberGrid from './NumberGrid.jsx';
import SimulateModal from './SimulateModal.jsx';
import { generateCombinations, saveCombination } from '../services/combos.service.js';
import { capitalize, dayName, formatDate } from '../../../utils/dates.js';

const MAX_WANTED = 5;
const keyOf = (code, numbers) => `${code}:${numbers.join('-')}`;
const pad = (n) => String(n).padStart(2, '0');

export default function GeneratorPanel({ nextDraw, onNextDraw, onSaved }) {
  const toast = useToast();

  // Opciones (todas opcionales): por defecto se genera sin restricciones.
  const [showOptions, setShowOptions] = useState(false);
  const [mode, setMode] = useState('want'); // 'want' = quiero que salgan, 'avoid' = no quiero que salgan
  const [wanted, setWanted] = useState(new Set());
  const [avoided, setAvoided] = useState(new Set());
  const [balanced, setBalanced] = useState(false);
  const [amount, setAmount] = useState(1);

  const [generated, setGenerated] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(new Set());
  const [savingKey, setSavingKey] = useState('');
  const [simulating, setSimulating] = useState(null);

  const asList = (set) => [...set].sort((a, b) => a - b);
  const customized = wanted.size > 0 || avoided.size > 0 || balanced || amount > 1;

  /** Toca un número: se agrega o se quita según el modo elegido (nunca puede estar en los dos grupos). */
  function pick(n) {
    const isWanted = wanted.has(n);
    const isAvoided = avoided.has(n);

    if (mode === 'want') {
      if (isWanted) {
        setWanted(new Set([...wanted].filter((x) => x !== n)));
      } else if (wanted.size >= MAX_WANTED) {
        toast.error(`Puedes pedir como máximo ${MAX_WANTED} números fijos.`);
      } else {
        setWanted(new Set([...wanted, n]));
        if (isAvoided) setAvoided(new Set([...avoided].filter((x) => x !== n)));
      }
    } else if (isAvoided) {
      setAvoided(new Set([...avoided].filter((x) => x !== n)));
    } else {
      setAvoided(new Set([...avoided, n]));
      if (isWanted) setWanted(new Set([...wanted].filter((x) => x !== n)));
    }
  }

  const stateOf = (n) => (wanted.has(n) ? 'fixed' : avoided.has(n) ? 'excluded' : '');

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      const data = await generateCombinations({
        fijos: asList(wanted),
        excluidos: asList(avoided),
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
  const drawText = nextDraw ? `${capitalize(dayName(nextDraw.dia_semana))} ${formatDate(nextDraw.fecha)}, ${nextDraw.hora}` : null;

  return (
    <>
      <div className="panel">
        <div className="step-head">
          <span className="step-num">1</span>
          <div>
            <h3 className="panel-title" style={{ margin: 0 }}>Genera tus combinaciones</h3>
            <p className="panel-note" style={{ margin: '4px 0 0' }}>
              Pulsa el botón y el sistema te propone combinaciones de 7 estilos distintos
              {drawText && <> para el sorteo del <b>{drawText}</b></>}.
            </p>
          </div>
        </div>

        {error && <div className="alert error" style={{ marginTop: 14 }}>{error}</div>}

        <div className="panel-actions" style={{ marginTop: 18 }}>
          <button className="btn-primary btn-big" onClick={generate} disabled={generating}>
            {generating ? 'Generando…' : generated ? 'Generar otras' : 'Generar combinaciones'}
          </button>
          <button
            type="button"
            className="btn-link options-toggle"
            onClick={() => setShowOptions((v) => !v)}
            aria-expanded={showOptions}
          >
            {showOptions ? 'Ocultar opciones' : 'Quiero elegir algunos detalles'}
            <IconChevronDown width={14} height={14} style={showOptions ? { transform: 'rotate(180deg)' } : undefined} />
            {!showOptions && customized && <span className="badge-dot" title="Tienes opciones activas" />}
          </button>
        </div>

        {showOptions && (
          <div className="options-box">
            <h4>Elige tus números (opcional)</h4>
            <p className="panel-note" style={{ margin: '0 0 12px' }}>
              Primero elige qué quieres marcar y luego toca los números.
            </p>

            <div className="mode-toggle" role="radiogroup" aria-label="Qué quieres marcar">
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'want'}
                className={`mode-btn want ${mode === 'want' ? 'active' : ''}`}
                onClick={() => setMode('want')}
              >
                Quiero que salgan
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'avoid'}
                className={`mode-btn avoid ${mode === 'avoid' ? 'active' : ''}`}
                onClick={() => setMode('avoid')}
              >
                No quiero que salgan
              </button>
            </div>

            <NumberGrid stateOf={stateOf} onPick={pick} />

            <div className="pick-summary">
              <span><i className="dot gold" /> Siempre saldrán: <b>{wanted.size ? asList(wanted).map(pad).join(', ') : 'ninguno'}</b></span>
              <span><i className="dot red" /> Nunca saldrán: <b>{avoided.size ? asList(avoided).map(pad).join(', ') : 'ninguno'}</b></span>
              {(wanted.size > 0 || avoided.size > 0) && (
                <button type="button" className="btn-link" onClick={() => { setWanted(new Set()); setAvoided(new Set()); }}>
                  Borrar selección
                </button>
              )}
            </div>

            <h4 style={{ marginTop: 22 }}>Otras opciones</h4>
            <label className="check-row">
              <input type="checkbox" checked={balanced} onChange={(e) => setBalanced(e.target.checked)} />
              <span>
                <b>Evitar combinaciones raras</b>
                <small>
                  Descarta cosas como 1-2-3-4-5-6, todos pares o todos impares. No cambia tu probabilidad, pero evita
                  combinaciones que mucha gente juega (así, si ganas, es menos probable compartir el premio).
                </small>
              </span>
            </label>

            <div className="amount-row">
              <label htmlFor="amount-select">Cuántas combinaciones quieres de cada estilo</label>
              <select id="amount-select" value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ maxWidth: 120 }}>
                {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {generated && (
        <div className="panel">
          <div className="step-head">
            <span className="step-num">2</span>
            <div style={{ flex: 1 }}>
              <h3 className="panel-title" style={{ margin: 0 }}>Elige las que te gusten y guárdalas</h3>
              <p className="panel-note" style={{ margin: '4px 0 0' }}>
                Basado en {generated.sorteosAnalizados} sorteos. Al guardarlas quedan en la pestaña «Mis combinaciones».
              </p>
            </div>
            <button className="btn-outline" onClick={saveAll} disabled={pending === 0 || Boolean(savingKey)}>
              <IconSave /> {pending === 0 ? 'Todas guardadas' : `Guardar todas (${pending})`}
            </button>
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
                          title="¿Cómo le habría ido en sorteos pasados?"
                          aria-label="¿Cómo le habría ido en sorteos pasados?"
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
