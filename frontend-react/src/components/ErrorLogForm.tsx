import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type JSX,
} from 'react';

import { apiErrorMessage } from '@/api/client';
import QuillEditor from '@/components/QuillEditor';
import { useClickOutside } from '@/hooks/useClickOutside';
import { errorLogsService } from '@/services/errorLogs';
import { screensService } from '@/services/screens';
import { usersService } from '@/services/users';
import {
  ERROR_ENVIRONMENTS,
  ERROR_PRIORITIES,
  LOG_TYPES,
  type ErrorEnvironment,
  type ErrorLogDetail,
  type ErrorPriority,
  type LogType,
  type Screen,
} from '@/types/errorLog';
import type { User } from '@/types/user';

const OTHER_SCREEN_VALUE = -1;
const OTHER_SCREEN_LABEL = 'Other (specify)';

interface Props {
  errorLog: ErrorLogDetail | null;
  onSaved: (saved: ErrorLogDetail) => void;
  onCancel: () => void;
}

export default function ErrorLogForm({ errorLog, onSaved, onCancel }: Props): JSX.Element {
  const root = useRef<HTMLDivElement>(null);

  const [screens, setScreens] = useState<Screen[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ErrorPriority>('Medium');
  const [environment, setEnvironment] = useState<ErrorEnvironment>('Dev');
  const [logType, setLogType] = useState<LogType>('Error');
  const [screenId, setScreenId] = useState<number | null>(null);
  const [screenFreeText, setScreenFreeText] = useState('');
  const [assignedToId, setAssignedToId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [screenQuery, setScreenQuery] = useState('');
  const [screenDropdownOpen, setScreenDropdownOpen] = useState(false);

  const isEdit = errorLog !== null;

  useEffect(() => {
    void screensService.list().then(setScreens);
    void usersService.list().then(setUsers);
  }, []);

  // Mirrors Angular's ngOnChanges: reset the whole form whenever the bound log changes,
  // including the null -> create case.
  useEffect(() => {
    if (errorLog) {
      setTitle(errorLog.title);
      setDescription(errorLog.description);
      setPriority(errorLog.priority);
      setEnvironment(errorLog.environment);
      setLogType(errorLog.log_type);
      setScreenId(errorLog.screen?.id ?? (errorLog.screen_name_freetext ? OTHER_SCREEN_VALUE : null));
      setScreenFreeText(errorLog.screen_name_freetext ?? '');
      setAssignedToId(errorLog.assigned_to?.id ?? null);
      setScreenQuery(errorLog.screen?.name ?? (errorLog.screen_name_freetext ? OTHER_SCREEN_LABEL : ''));
    } else {
      setTitle('');
      setDescription('');
      setPriority('Medium');
      setEnvironment('Dev');
      setLogType('Error');
      setScreenId(null);
      setScreenFreeText('');
      setAssignedToId(null);
      setScreenQuery('');
    }
    setSelectedFiles([]);
    setError(null);
  }, [errorLog]);

  useClickOutside(
    root,
    useCallback(() => setScreenDropdownOpen(false), []),
    screenDropdownOpen,
  );

  const hasDescription = description.replace(/<[^>]*>/g, '').trim().length > 0;

  const query = screenQuery.trim().toLowerCase();
  const filteredScreens = query ? screens.filter((s) => s.name.toLowerCase().includes(query)) : screens;

  function selectedScreenLabel(): string {
    if (screenId === OTHER_SCREEN_VALUE) return OTHER_SCREEN_LABEL;
    return screens.find((s) => s.id === screenId)?.name ?? '';
  }

  function onScreenQueryChange(value: string): void {
    setScreenQuery(value);
    setScreenDropdownOpen(true);
    // Typing past a chosen screen clears the selection so a stale id can't be submitted.
    if (screenId !== null && value !== selectedScreenLabel()) {
      setScreenId(null);
    }
  }

  function selectScreen(screen: Screen): void {
    setScreenId(screen.id);
    setScreenQuery(screen.name);
    setScreenDropdownOpen(false);
  }

  function selectOtherScreen(): void {
    setScreenId(OTHER_SCREEN_VALUE);
    setScreenQuery(OTHER_SCREEN_LABEL);
    setScreenDropdownOpen(false);
  }

  function addFiles(files: File[]): void {
    setSelectedFiles((list) => [...list, ...files]);
  }

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files) {
      addFiles(Array.from(event.target.files));
      event.target.value = '';
    }
  }

  /** Pasting a screenshot (e.g. from Snipping Tool) or a copied file attaches it directly. */
  function onPaste(event: ClipboardEvent<HTMLDivElement>): void {
    const items = event.clipboardData?.items;
    if (!items || items.length === 0) return;

    const pastedFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          const named =
            file.name && file.name !== 'blob'
              ? file
              : new File([file], `pasted-${Date.now()}.${file.type.split('/')[1] || 'png'}`, { type: file.type });
          pastedFiles.push(named);
        }
      }
    }
    if (pastedFiles.length > 0) {
      event.preventDefault();
      addFiles(pastedFiles);
    }
  }

  function removeFile(index: number): void {
    setSelectedFiles((list) => list.filter((_, i) => i !== index));
  }

  async function submit(): Promise<void> {
    if (!title || !hasDescription) return;

    setSaving(true);
    setError(null);

    const payload = {
      title,
      description,
      priority,
      environment,
      log_type: logType,
      screen_id: screenId !== null && screenId !== OTHER_SCREEN_VALUE ? screenId : null,
      screen_name_freetext: screenId === OTHER_SCREEN_VALUE ? screenFreeText : null,
      assigned_to_id: assignedToId,
    };

    let saved: ErrorLogDetail;
    try {
      saved = errorLog ? await errorLogsService.update(errorLog.id, payload) : await errorLogsService.create(payload);
    } catch (err) {
      setSaving(false);
      setError(apiErrorMessage(err, 'Failed to save error log'));
      return;
    }

    // A failed attachment upload still counts as a successful save -- same as the Angular
    // version, which emitted `saved` from both the next and error branches.
    if (selectedFiles.length > 0) {
      try {
        await errorLogsService.uploadAttachments(saved.id, selectedFiles);
      } catch {
        /* ignored on purpose */
      }
    }

    setSaving(false);
    onSaved(saved);
  }

  return (
    <div ref={root} className="c-error-log-form" onPaste={onPaste}>
      <div className="modal-topbar">
        <span className="modal-title">{isEdit ? 'Edit Item' : 'Log a New Feature/Bug'}</span>
        <button className="btn-icon" type="button" aria-label="Close" title="Close" onClick={onCancel}>
          <i className="material-icons">close</i>
        </button>
      </div>

      <div className="modal-body">
        <div className="form-grid">
          <div className="form-field form-field--full">
            <label className="form-label" htmlFor="log-title">
              Title <span className="form-req">*</span>
            </label>
            <input
              id="log-title"
              type="text"
              maxLength={300}
              placeholder="Short summary of the error"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-field form-field--full">
            <label className="form-label" htmlFor="log-description">
              Description <span className="form-req">*</span>
            </label>
            <QuillEditor
              value={description}
              onChange={setDescription}
              placeholder="Steps to reproduce, expected vs actual behavior..."
            />
          </div>

          <div className="form-field autocomplete-field">
            <label className="form-label" htmlFor="log-screen">
              Screen
            </label>
            <input
              id="log-screen"
              type="text"
              autoComplete="off"
              placeholder="Search screens…"
              value={screenQuery}
              onChange={(e) => onScreenQueryChange(e.target.value)}
              onFocus={() => setScreenDropdownOpen(true)}
            />
            {screenDropdownOpen && (
              <ul className="autocomplete-list">
                {filteredScreens.map((screen) => (
                  <li key={screen.id} onClick={() => selectScreen(screen)}>
                    {screen.name} <span className="option-meta">({screen.category})</span>
                  </li>
                ))}
                <li className="option-other" onClick={selectOtherScreen}>
                  {OTHER_SCREEN_LABEL}
                </li>
                {filteredScreens.length === 0 && <li className="option-empty">No matching screens</li>}
              </ul>
            )}
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="log-type">
              Type
            </label>
            <div className="select-wrap">
              <select id="log-type" value={logType} onChange={(e) => setLogType(e.target.value as LogType)}>
                {LOG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="log-priority">
              Priority
            </label>
            <div className="select-wrap">
              <select id="log-priority" value={priority} onChange={(e) => setPriority(e.target.value as ErrorPriority)}>
                {ERROR_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="log-environment">
              Environment
            </label>
            <div className="select-wrap">
              <select
                id="log-environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as ErrorEnvironment)}
              >
                {ERROR_ENVIRONMENTS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {screenId === OTHER_SCREEN_VALUE && (
            <div className="form-field form-field--full">
              <label className="form-label" htmlFor="log-screen-freetext">
                Screen name (free text)
              </label>
              <input
                id="log-screen-freetext"
                type="text"
                maxLength={300}
                placeholder="Where in the app did this happen?"
                value={screenFreeText}
                onChange={(e) => setScreenFreeText(e.target.value)}
              />
            </div>
          )}

          <div className="form-field form-field--full">
            <label className="form-label" htmlFor="log-assigned">
              Assigned to
            </label>
            <div className="select-wrap">
              <select
                id="log-assigned"
                value={assignedToId ?? ''}
                onChange={(e) => setAssignedToId(e.target.value || null)}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field form-field--full">
            <label className="form-label">Attachments</label>
            <div className="paste-zone" tabIndex={0}>
              <i className="material-icons">content_paste</i>
              <span>
                Click here and press <strong>Ctrl+V</strong> to paste a screenshot, or choose files below
              </span>
            </div>
            <input type="file" multiple onChange={onFilesSelected} />
            {selectedFiles.length > 0 && (
              <ul className="file-list">
                {selectedFiles.map((file, i) => (
                  <li key={`${file.name}-${i}`}>
                    <span className="file-name">{file.name}</span>
                    <button className="btn-icon" type="button" aria-label="Remove file" onClick={() => removeFile(i)}>
                      <i className="material-icons">close</i>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {error && <p className="form-error-msg">{error}</p>}
      </div>

      <div className="modal-footer">
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={saving || !title || !hasDescription}
          onClick={submit}
        >
          {saving && <span className="spinner" />}
          {isEdit ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </div>
  );
}
