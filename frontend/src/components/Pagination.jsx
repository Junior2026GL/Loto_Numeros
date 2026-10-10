const MAX_BUTTONS = 7;

function getPageNumbers(current, total) {
  if (total <= MAX_BUTTONS + 1) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= MAX_BUTTONS - 1) {
    return [...Array.from({ length: MAX_BUTTONS }, (_, i) => i + 1), 'ellipsis', total];
  }
  if (current >= total - (MAX_BUTTONS - 2)) {
    return [1, 'ellipsis', ...Array.from({ length: MAX_BUTTONS }, (_, i) => total - MAX_BUTTONS + 1 + i)];
  }
  const start = current - 2;
  const end = current + 2;
  return [1, 'ellipsis', ...Array.from({ length: end - start + 1 }, (_, i) => start + i), 'ellipsis', total];
}

export default function Pagination({ page, pageSize, total, onPageChange }) {
  if (!total) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);
  const pages = getPageNumbers(safePage, totalPages);

  function go(p) {
    const clamped = Math.min(Math.max(1, p), totalPages);
    if (clamped !== safePage) onPageChange(clamped);
  }

  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        <strong>{start}–{end}</strong> de <strong>{total}</strong>
      </span>

      <div className="pagination-pages">
        <button
          type="button"
          className="pagination-btn nav"
          onClick={() => go(1)}
          disabled={safePage === 1}
          aria-label="Primera página"
        >
          «
        </button>
        <button
          type="button"
          className="pagination-btn nav"
          onClick={() => go(safePage - 1)}
          disabled={safePage === 1}
          aria-label="Página anterior"
        >
          ‹
        </button>

        {pages.map((p, i) => (
          p === 'ellipsis'
            ? <span className="pagination-ellipsis" key={`e${i}`}>…</span>
            : (
              <button
                type="button"
                key={p}
                className={`pagination-btn ${p === safePage ? 'active' : ''}`}
                onClick={() => go(p)}
                aria-current={p === safePage ? 'page' : undefined}
              >
                {p}
              </button>
            )
        ))}

        <button
          type="button"
          className="pagination-btn nav"
          onClick={() => go(safePage + 1)}
          disabled={safePage === totalPages}
          aria-label="Página siguiente"
        >
          ›
        </button>
        <button
          type="button"
          className="pagination-btn nav"
          onClick={() => go(totalPages)}
          disabled={safePage === totalPages}
          aria-label="Última página"
        >
          »
        </button>
      </div>

      <span className="pagination-meta">Pág. {safePage} / {totalPages}</span>
    </div>
  );
}
