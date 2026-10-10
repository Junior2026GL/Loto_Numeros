/**
 * Cuadrícula de números para elegir. `stateOf(n)` devuelve el estado de cada número
 * ('fixed', 'excluded', 'selected' o nada) y `onPick(n)` se llama al tocarlo.
 */
export default function NumberGrid({ min = 1, max = 33, stateOf, onPick, disabled = false }) {
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="num-grid" role="group" aria-label="Números">
      {numbers.map((n) => {
        const state = stateOf?.(n) || '';
        return (
          <button
            type="button"
            key={n}
            className={`num-cell ${state}`}
            onClick={() => onPick(n)}
            disabled={disabled}
            aria-pressed={Boolean(state)}
            aria-label={`Número ${n}${state ? `, ${state === 'fixed' ? 'fijo' : state === 'excluded' ? 'excluido' : 'elegido'}` : ''}`}
          >
            {String(n).padStart(2, '0')}
          </button>
        );
      })}
    </div>
  );
}
