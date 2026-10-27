import { useEffect } from 'react';
import TermsContent from './TermsContent.jsx';

/** Terms in a scrollable sheet, so reading them doesn't leave the signup wizard. */
export default function TermsDialog({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop top" role="dialog" aria-modal="true" aria-label="תנאי הצטרפות לקהילה" onClick={onClose}>
      <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>תנאי הצטרפות לקהילה</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="סגירה">×</button>
        </div>
        <div className="sheet-body"><TermsContent /></div>
        <button type="button" className="btn primary block" onClick={onClose}>סגירה</button>
      </div>
    </div>
  );
}
