import { TYPE_LABELS, APP_STATUS, APP_STATUS_ADMIN, CAMPAIGN_STATUS, USER_STATUS } from '../labels.js';

export function Field({ label, error, hint, children, required }) {
  return (
    <label className={`field${error ? ' has-error' : ''}`}>
      <span className="field-label">{label}{required && <span className="req"> *</span>}</span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export const TypeBadge = ({ type }) => <span className={`badge type-${type}`}>{TYPE_LABELS[type]}</span>;
export const AppStatusChip = ({ status, admin }) => (
  <span className={`chip app-${status}`}>{(admin ? APP_STATUS_ADMIN : APP_STATUS)[status]}</span>
);
export const CampaignStatusChip = ({ status }) => <span className={`chip camp-${status}`}>{CAMPAIGN_STATUS[status]}</span>;
export const UserStatusChip = ({ status }) => <span className={`chip user-${status}`}>{USER_STATUS[status]}</span>;

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="alert error" role="alert">{typeof error === 'string' ? error : error.message}</div>;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function igUrl(handle) { return handle ? `https://instagram.com/${handle}` : null; }
export function ttUrl(handle) { return handle ? `https://tiktok.com/@${handle}` : null; }

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
