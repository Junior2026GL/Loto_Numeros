import Modal from './Modal.jsx';

/** Confirmación propia (en lugar del `confirm` del navegador): mismo estilo y accesible por teclado. */
export default function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false, busy = false, onConfirm, onCancel }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={420}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}
