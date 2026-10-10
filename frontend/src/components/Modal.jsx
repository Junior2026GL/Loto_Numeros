import { IconClose } from './icons.jsx';

export default function Modal({ title, subtitle, icon, onClose, children, footer, width = 480 }) {
  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ maxWidth: width }}>
        <div className="modal-header">
          <div className="modal-header-text">
            {icon && <span className="modal-header-icon">{icon}</span>}
            <div>
              <h3>{title}</h3>
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <IconClose />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
