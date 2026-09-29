import Quill from 'quill';
import { useEffect, useRef, type JSX } from 'react';

/**
 * Thin controlled wrapper around Quill 2, standing in for `ngx-quill`'s <quill-editor>.
 * Wrapping Quill directly (rather than pulling in a framework-specific binding) keeps the
 * editor config identical to the Angular app's and avoids a peer-dependency chase.
 */
interface Props {
  value: string;
  placeholder?: string;
  onChange: (html: string) => void;
}

const TOOLBAR = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ header: [2, 3, false] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block', 'link'],
  ['clean'],
];

export default function QuillEditor({ value, placeholder = '', onChange }: Props): JSX.Element {
  const container = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  /** Kept in a ref so the Quill instance is created once, not re-created per render. */
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** Guards the sync effect below so echoing our own emitted value back doesn't move the caret. */
  const applyingExternalValue = useRef(false);

  useEffect(() => {
    if (!container.current) return;

    const editorEl = document.createElement('div');
    container.current.appendChild(editorEl);

    const quill = new Quill(editorEl, {
      theme: 'snow',
      placeholder,
      modules: { toolbar: TOOLBAR },
    });
    quillRef.current = quill;

    if (value) {
      quill.clipboard.dangerouslyPasteHTML(value);
    }

    quill.on('text-change', () => {
      if (applyingExternalValue.current) return;
      // Quill represents "empty" as "<p><br></p>"; normalise that to '' so required-field
      // checks behave the way they did with ngx-quill's `[format]="'html'"` binding.
      onChangeRef.current(quill.getText().trim().length === 0 ? '' : quill.getSemanticHTML());
    });

    return () => {
      quillRef.current = null;
      if (container.current) container.current.innerHTML = '';
    };
    // Mount-only: the editor owns its own DOM, and `value` is reconciled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;

    const current = quill.getText().trim().length === 0 ? '' : quill.getSemanticHTML();
    if (value === current) return;

    applyingExternalValue.current = true;
    quill.setContents([]);
    if (value) quill.clipboard.dangerouslyPasteHTML(value);
    applyingExternalValue.current = false;
  }, [value]);

  return (
    <div className="quill-host">
      <div ref={container} />
    </div>
  );
}
