import { useCallback, useEffect, useRef, useState, type JSX, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { apiErrorMessage } from '@/api/client';
import ErrorLogDetailDrawer from '@/components/ErrorLogDetailDrawer';
import ErrorLogForm from '@/components/ErrorLogForm';
import HistoryModal from '@/components/HistoryModal';
import MultiSelectDropdown, { type MultiSelectOption } from '@/components/MultiSelectDropdown';
import { useDocumentEvent } from '@/hooks/useEventListener';
import { errorLogsService, UNASSIGNED_FILTER_VALUE, type ErrorLogFilters } from '@/services/errorLogs';
import { screensService } from '@/services/screens';
import { usersService } from '@/services/users';
import { selectIsSuperAdmin, useAuthStore } from '@/stores/auth';
import { toast } from '@/stores/toast';
import {
  ERROR_ENVIRONMENTS,
  ERROR_PRIORITIES,
  ERROR_STATUSES,
  LOG_TYPES,
  STATUS_LABELS,
  type ErrorEnvironment,
  type ErrorLogDetail,
  type ErrorLogListItem,
  type ErrorPriority,
  type ErrorStatus,
  type LogType,
  type Screen,
} from '@/types/errorLog';
import type { User } from '@/types/user';
import { formatDate } from '@/utils/date';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const SORT_COLUMNS = [
  { key: 'reference_id', label: 'Ref ID' },
  { key: 'title', label: 'Title' },
  { key: 'log_type', label: 'Type' },
  { key: 'screen', label: 'Screen' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assigned_to', label: 'Assigned To' },
  { key: 'updated_at', label: 'Updated' },
];

const statusOptions: MultiSelectOption[] = ERROR_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
const priorityOptions: MultiSelectOption[] = ERROR_PRIORITIES.map((p) => ({ value: p, label: p }));
const logTypeOptions: MultiSelectOption[] = LOG_TYPES.map((t) => ({ value: t, label: t }));

export default function ErrorLogListView(): JSX.Element {
  const isSuperAdmin = useAuthStore(selectIsSuperAdmin);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [logs, setLogs] = useState<ErrorLogListItem[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ErrorLogDetail | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formEditLog, setFormEditLog] = useState<ErrorLogDetail | null>(null);

  const [historyLog, setHistoryLog] = useState<ErrorLogDetail | null>(null);
  const [openMenuLogId, setOpenMenuLogId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [statusFilter, setStatusFilter] = useState<ErrorStatus[]>([]);
  const [screenFilter, setScreenFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<ErrorPriority[]>([]);
  const [environmentFilter, setEnvironmentFilter] = useState<ErrorEnvironment | ''>('');
  const [logTypeFilter, setLogTypeFilter] = useState<LogType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  /** Debounced separately so typing doesn't fire a request per keystroke. */
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  /** Click cycles a column: ascending -> descending -> back to the default order. */
  function toggleSort(column: string): void {
    setPage(1);
    if (sortBy !== column) {
      setSortBy(column);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortBy(null);
    }
  }

  function sortIcon(column: string): string {
    if (sortBy !== column) return 'unfold_more';
    return sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  async function copyDetails(log: ErrorLogListItem, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    closeMenu();
    const text = `RefID-${log.reference_id}\nTitle-${log.title}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API is unavailable on non-secure origins; fall back to a hidden textarea.
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      if (!ok) {
        toast.show('Failed to copy details', 'error');
        return;
      }
    }
    toast.show('Details copied', 'success');
  }

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    const filters: ErrorLogFilters = { page, page_size: pageSize };

    if (statusFilter.length > 0) filters.status_filter = statusFilter.join(',');
    if (screenFilter) filters.screen_id = screenFilter;
    if (assigneeFilter) filters.assigned_to_id = assigneeFilter;
    if (priorityFilter.length > 0) filters.priority = priorityFilter.join(',');
    if (environmentFilter) filters.environment = environmentFilter;
    if (logTypeFilter.length > 0) filters.log_type = logTypeFilter.join(',');
    if (debouncedSearch.trim()) filters.search = debouncedSearch.trim();
    if (sortBy) {
      filters.sort_by = sortBy;
      filters.sort_dir = sortDir;
    }

    try {
      const res = await errorLogsService.list(filters);
      setLogs(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    statusFilter,
    screenFilter,
    assigneeFilter,
    priorityFilter,
    environmentFilter,
    logTypeFilter,
    debouncedSearch,
    sortBy,
    sortDir,
  ]);

  // Any change to a filter or to the page re-runs the query. Filters reset the page to 1
  // through the setters below, so a stale page can never be combined with a new filter.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void screensService.list(true).then(setScreens);
    void usersService.list().then(setUsers);
  }, []);

  function onSearchChange(value: string): void {
    setSearchTerm(value);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(value);
    }, 300);
  }

  useEffect(() => () => clearTimeout(searchDebounce.current), []);

  /** Any filter change invalidates the current page, so jump back to page 1. */
  function withFirstPage<T>(setter: (value: T) => void): (value: T) => void {
    return (value: T) => {
      setPage(1);
      setter(value);
    };
  }

  function goToPage(target: number): void {
    if (target < 1 || target > totalPages || target === page) return;
    setPage(target);
  }

  // ---- Detail / form / history ----

  async function viewDetail(log: ErrorLogListItem): Promise<void> {
    setSelectedLog(await errorLogsService.get(log.id));
  }

  function openCreate(): void {
    setFormEditLog(null);
    setFormOpen(true);
  }

  async function openEdit(log: ErrorLogListItem, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    closeMenu();
    setFormEditLog(await errorLogsService.get(log.id));
    setFormOpen(true);
  }

  async function onFormSaved(saved: ErrorLogDetail): Promise<void> {
    setFormOpen(false);
    await refresh();
    if (selectedLog?.id === saved.id) {
      setSelectedLog(await errorLogsService.get(saved.id));
    }
  }

  async function changeStatus(log: ErrorLogListItem, status: ErrorStatus): Promise<void> {
    await errorLogsService.updateStatus(log.id, status);
    await refresh();
    if (selectedLog?.id === log.id) {
      await viewDetail(log);
    }
  }

  async function deleteLog(log: ErrorLogListItem, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    closeMenu();
    if (!confirm(`Delete error log "${log.title}"? This cannot be undone.`)) return;

    try {
      await errorLogsService.remove(log.id);
      toast.show('Error log deleted', 'success');
      await refresh();
      if (selectedLog?.id === log.id) setSelectedLog(null);
    } catch (err) {
      toast.show(apiErrorMessage(err, 'Failed to delete error log'), 'error');
    }
  }

  async function viewHistory(log: ErrorLogListItem, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    closeMenu();
    setHistoryLog(await errorLogsService.get(log.id));
  }

  // ---- Row "more actions" menu ----

  function closeMenu(): void {
    setOpenMenuLogId(null);
    setMenuPosition(null);
  }

  function toggleMenu(log: ErrorLogListItem, event: MouseEvent): void {
    event.stopPropagation();
    if (openMenuLogId === log.id) {
      closeMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    // Fixed positioning (computed from the button's actual screen position) so the menu can
    // never be clipped by an ancestor's `overflow: hidden` -- which happens with
    // `position: absolute` when the table is short (few filtered rows) and the menu would
    // otherwise need to extend past the table's own bottom edge.
    setMenuPosition({ top: rect.bottom + 4, left: rect.left });
    setOpenMenuLogId(log.id);
  }

  /** Any click outside an open row menu closes it -- the menu itself stops propagation. */
  useDocumentEvent('click', closeMenu, openMenuLogId !== null);

  // Reacts to the query param (not just the initial mount) so clicking a notification while
  // already on this page -- which only changes query params, not the route -- still opens the
  // detail drawer.
  const openId = searchParams.get('open');
  useEffect(() => {
    if (!openId) return;
    void errorLogsService.get(openId).then((detail) => {
      setSelectedLog(detail);
      navigate('/error-logs', { replace: true });
    });
  }, [openId, navigate]);

  return (
    <div className="c-error-log-list">
      <div className="page-header">
        <h1 className="text-page-title">Feature/Bugs Tracking</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          <i className="material-icons">add</i>
          Log Item
        </button>
      </div>

      <div className="filters">
        <div className="form-field form-field--search">
          <label className="form-label" htmlFor="filter-search">
            Search
          </label>
          <div className="search-wrap">
            <i className="material-icons">search</i>
            <input
              id="filter-search"
              type="text"
              placeholder="Search reference ID, title, description, screen, people, status..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">Status</label>
          <MultiSelectDropdown
            options={statusOptions}
            selected={statusFilter}
            onSelectedChange={withFirstPage((values: string[]) => setStatusFilter(values as ErrorStatus[]))}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Priority</label>
          <MultiSelectDropdown
            options={priorityOptions}
            selected={priorityFilter}
            onSelectedChange={withFirstPage((values: string[]) => setPriorityFilter(values as ErrorPriority[]))}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Type</label>
          <MultiSelectDropdown
            options={logTypeOptions}
            selected={logTypeFilter}
            onSelectedChange={withFirstPage((values: string[]) => setLogTypeFilter(values as LogType[]))}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="filter-environment">
            Environment
          </label>
          <div className="select-wrap">
            <select
              id="filter-environment"
              value={environmentFilter}
              onChange={(e) => withFirstPage(setEnvironmentFilter)(e.target.value as ErrorEnvironment | '')}
            >
              <option value="">All</option>
              {ERROR_ENVIRONMENTS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="filter-screen">
            Screen
          </label>
          <div className="select-wrap">
            <select
              id="filter-screen"
              value={screenFilter}
              onChange={(e) => withFirstPage(setScreenFilter)(e.target.value)}
            >
              <option value="">All</option>
              {screens.map((screen) => (
                <option key={screen.id} value={screen.id}>
                  {screen.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="filter-assignee">
            Assignee
          </label>
          <div className="select-wrap">
            <select
              id="filter-assignee"
              value={assigneeFilter}
              onChange={(e) => withFirstPage(setAssigneeFilter)(e.target.value)}
            >
              <option value="">All</option>
              <option value={UNASSIGNED_FILTER_VALUE}>Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="table-scroll" onScroll={closeMenu}>
        <table className="data-table">
          <thead className="data-table__header">
            <tr>
              <th />
              {SORT_COLUMNS.map((col) => (
                <th key={col.key} className="sortable" onClick={() => toggleSort(col.key)}>
                  {col.label}
                  <i className={'material-icons sort-icon' + (sortBy === col.key ? ' sort-icon--active' : '')}>
                    {sortIcon(col.key)}
                  </i>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="data-table__row" onClick={() => viewDetail(log)}>
                <td className="col-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="kebab-wrap">
                    <button className="btn-icon btn-more" title="More actions" onClick={(e) => toggleMenu(log, e)}>
                      <i className="material-icons">more_vert</i>
                    </button>

                    {openMenuLogId === log.id && menuPosition && (
                      <div
                        className="kebab-menu"
                        style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button className="kebab-menu-item" type="button" onClick={(e) => openEdit(log, e)}>
                          <i className="material-icons">edit</i> Edit
                        </button>
                        <button className="kebab-menu-item" type="button" onClick={(e) => copyDetails(log, e)}>
                          <i className="material-icons">content_copy</i> Copy Details
                        </button>
                        <button className="kebab-menu-item" type="button" onClick={(e) => viewHistory(log, e)}>
                          <i className="material-icons">history</i> View History
                        </button>
                        {isSuperAdmin && (
                          <>
                            <div className="kebab-menu-divider" />
                            <button
                              className="kebab-menu-item kebab-menu-item--danger"
                              type="button"
                              onClick={(e) => deleteLog(log, e)}
                            >
                              <i className="material-icons">delete</i> Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="reference-cell" title={log.reference_id}>
                  {log.reference_id}
                </td>
                <td className="title-cell" title={log.title}>
                  {log.title}
                </td>
                <td>
                  <span
                    className={
                      'type-badge' +
                      (log.log_type === 'Feature' ? ' type-badge--feature' : '') +
                      (log.log_type === 'Suggestion' ? ' type-badge--suggestion' : '')
                    }
                  >
                    {log.log_type}
                  </span>
                </td>
                <td>{log.screen?.name ?? log.screen_name_freetext ?? '—'}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="select-wrap status-select">
                    <select value={log.status} onChange={(e) => changeStatus(log, e.target.value as ErrorStatus)}>
                      {ERROR_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>{log.priority}</td>
                <td>{log.assigned_to?.name ?? 'Unassigned'}</td>
                <td>{formatDate(log.updated_at, 'short')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && logs.length === 0 && <p className="empty">No error logs found.</p>}

      {total > 0 && (
        <div className="pagination">
          <span className="pagination-summary">
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="pagination-controls">
            <div className="page-size">
              <label className="page-size-label" htmlFor="footer-page-size">
                Per page
              </label>
              <div className="select-wrap">
                <select
                  id="footer-page-size"
                  value={pageSize}
                  onChange={(e) => withFirstPage(setPageSize)(Number(e.target.value))}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn btn-sm btn-ghost" disabled={page === 1} onClick={() => goToPage(page - 1)}>
              <i className="material-icons">chevron_left</i>
              Prev
            </button>
            <button className="btn btn-sm btn-ghost" disabled={page === totalPages} onClick={() => goToPage(page + 1)}>
              Next
              <i className="material-icons">chevron_right</i>
            </button>
          </div>
        </div>
      )}

      {selectedLog && (
        <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
          <div className="modal-panel detail-panel" onClick={(e) => e.stopPropagation()}>
            <ErrorLogDetailDrawer errorLog={selectedLog} onClose={() => setSelectedLog(null)} />
          </div>
        </div>
      )}

      {formOpen && (
        <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <ErrorLogForm errorLog={formEditLog} onSaved={onFormSaved} onCancel={() => setFormOpen(false)} />
          </div>
        </div>
      )}

      {historyLog && <HistoryModal errorLog={historyLog} onClose={() => setHistoryLog(null)} />}
    </div>
  );
}
