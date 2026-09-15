export default function EmptyState({ title, message, action }) {
  return <div className="empty-state"><div className="empty-symbol" aria-hidden="true">○</div><strong>{title}</strong><p>{message}</p>{action && <button className="text-button" disabled>{action}</button>}</div>
}
