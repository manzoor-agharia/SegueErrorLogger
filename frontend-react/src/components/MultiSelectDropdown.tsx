import { useCallback, useRef, useState, type ChangeEvent, type JSX } from 'react';

import { useClickOutside } from '@/hooks/useClickOutside';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface Props {
  options: MultiSelectOption[];
  selected: string[];
  allLabel?: string;
  onSelectedChange: (values: string[]) => void;
}

export default function MultiSelectDropdown({
  options,
  selected,
  allLabel = 'All',
  onSelectedChange,
}: Props): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useClickOutside(
    root,
    useCallback(() => setOpen(false), []),
    open,
  );

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`;

  function toggleOption(value: string, event: ChangeEvent<HTMLInputElement>): void {
    const { checked } = event.target;
    onSelectedChange(checked ? [...selected, value] : selected.filter((v) => v !== value));
  }

  return (
    <div ref={root} className="c-multi-select">
      <button type="button" className="ms-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={`ms-summary${selected.length === 0 ? ' ms-summary--placeholder' : ''}`}>{summary}</span>
        <i className="material-icons">arrow_drop_down</i>
      </button>

      {open && (
        <div className="ms-panel">
          <div className="ms-panel-header">
            <span>{selected.length} selected</span>
            {selected.length > 0 && (
              <button type="button" className="ms-clear" onClick={() => onSelectedChange([])}>
                Clear
              </button>
            )}
          </div>
          <ul className="ms-options">
            {options.map((option) => (
              <li key={option.value}>
                <label className="ms-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={(e) => toggleOption(option.value, e)}
                  />
                  <span>{option.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
