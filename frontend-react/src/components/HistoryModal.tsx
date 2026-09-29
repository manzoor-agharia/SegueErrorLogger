import { useMemo, type JSX } from 'react';

import { useDocumentEvent } from '@/hooks/useEventListener';
import { STATUS_LABELS, type ErrorLogDetail } from '@/types/errorLog';
import { formatDate } from '@/utils/date';

/**
 * Combines status changes and field edits into one chronological feed. Used from both the
 * error log list (per-row) and the detail drawer, so history is reachable without opening
 * the full detail view first.
 */
interface Props {
  errorLog: ErrorLogDetail | null;
  onClose: () => void;
}

interface HistoryEntry {
  id: string;
  summary: string;
  changedByName: string;
  changedAt: string;
}

export default function HistoryModal({ errorLog, onClose }: Props): JSX.Element {
  const combinedHistory = useMemo<HistoryEntry[]>(() => {
    if (!errorLog) return [];

    const statusEntries: HistoryEntry[] = errorLog.status_history.map((entry) => ({
      id: `status-${entry.id}`,
      summary: `${entry.old_status ? STATUS_LABELS[entry.old_status] : 'Created'} → ${STATUS_LABELS[entry.new_status]}`,
      changedByName: entry.changed_by.name,
      changedAt: entry.changed_at,
    }));
    const editEntries: HistoryEntry[] = errorLog.edit_history.map((entry) => ({
      id: `edit-${entry.id}`,
      summary: entry.summary,
      changedByName: entry.changed_by.name,
      changedAt: entry.changed_at,
    }));

    return [...statusEntries, ...editEntries].sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );
  }, [errorLog]);

  useDocumentEvent('keydown', (event) => {
    if (event.key === 'Escape') onClose();
  });

  return (
    <div className="c-history-modal">
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-panel history-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-topbar">
            <span className="modal-title">History</span>
            <button className="btn-icon" type="button" aria-label="Close" onClick={onClose}>
              <i className="material-icons">close</i>
            </button>
          </div>
          <div className="modal-body">
            {combinedHistory.length === 0 ? (
              <p className="empty">No changes recorded yet.</p>
            ) : (
              <ul className="status-history">
                {combinedHistory.map((entry) => (
                  <li key={entry.id}>
                    <span className="history-status">{entry.summary}</span>
                    <span className="history-meta">
                      {entry.changedByName} · {formatDate(entry.changedAt, 'medium')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
