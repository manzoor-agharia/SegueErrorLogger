import { useEffect, useMemo, useRef, useState, type JSX } from 'react';

import CommentsModal from '@/components/CommentsModal';
import StatusBadge from '@/components/StatusBadge';
import { useDocumentEvent } from '@/hooks/useEventListener';
import { errorLogsService } from '@/services/errorLogs';
import { STATUS_LABELS, type Attachment, type Comment, type ErrorLogDetail } from '@/types/errorLog';
import { formatDate } from '@/utils/date';

interface Props {
  errorLog: ErrorLogDetail | null;
  onClose: () => void;
  onCommentsChanged?: (comments: Comment[]) => void;
}

interface AttachmentPreview {
  attachment: Attachment;
  objectUrl: string | null;
  isImage: boolean;
}

export default function ErrorLogDetailDrawer({ errorLog, onClose, onCommentsChanged }: Props): JSX.Element | null {
  const [previews, setPreviews] = useState<AttachmentPreview[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(errorLog?.comments.length ?? 0);

  /** Mirrors `previews` so the cleanup function can revoke the latest set of object URLs. */
  const previewsRef = useRef(previews);
  previewsRef.current = previews;

  const images = useMemo(() => previews.filter((p) => p.isImage), [previews]);
  const viewerImage = viewerIndex === null ? null : (images[viewerIndex] ?? null);

  useEffect(() => {
    setCommentsOpen(false);
    setCommentCount(errorLog?.comments.length ?? 0);

    if (!errorLog) {
      setPreviews([]);
      return;
    }

    const initial: AttachmentPreview[] = errorLog.attachments.map((attachment) => ({
      attachment,
      objectUrl: null,
      isImage: attachment.content_type.startsWith('image/'),
    }));
    setPreviews(initial);

    // Image previews need the auth header, so each one is fetched as a blob and swapped in
    // as it arrives rather than being bound straight to <img src>.
    let cancelled = false;
    initial
      .filter((p) => p.isImage)
      .forEach(async (preview) => {
        try {
          const blob = await errorLogsService.fetchAttachment(preview.attachment.id);
          if (cancelled) {
            URL.revokeObjectURL(URL.createObjectURL(blob));
            return;
          }
          const objectUrl = URL.createObjectURL(blob);
          setPreviews((list) =>
            list.map((p) => (p.attachment.id === preview.attachment.id ? { ...p, objectUrl } : p)),
          );
        } catch {
          /* leave the card showing the generic file icon */
        }
      });

    return () => {
      cancelled = true;
      previewsRef.current.forEach((p) => {
        if (p.objectUrl) URL.revokeObjectURL(p.objectUrl);
      });
    };
  }, [errorLog]);

  function closeViewer(): void {
    setViewerIndex(null);
  }

  function showPrevImage(): void {
    const total = images.length;
    if (total === 0) return;
    setViewerIndex((i) => ((i ?? 0) - 1 + total) % total);
  }

  function showNextImage(): void {
    const total = images.length;
    if (total === 0) return;
    setViewerIndex((i) => ((i ?? 0) + 1) % total);
  }

  useDocumentEvent('keydown', (event) => {
    // While the comments modal is open it owns Escape, so the drawer stays put.
    if (commentsOpen) return;

    if (viewerIndex !== null) {
      if (event.key === 'Escape') closeViewer();
      if (event.key === 'ArrowLeft') showPrevImage();
      if (event.key === 'ArrowRight') showNextImage();
      return;
    }
    if (event.key === 'Escape') onClose();
  });

  async function download(attachment: Attachment): Promise<void> {
    const blob = await errorLogsService.fetchAttachment(attachment.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.original_filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openViewer(preview: AttachmentPreview): void {
    const index = images.indexOf(preview);
    if (index !== -1) setViewerIndex(index);
  }

  /** Keep the drawer's own comment-count badge in sync while the modal is open. */
  function handleCommentsChanged(comments: Comment[]): void {
    if (errorLog) errorLog.comments = comments;
    setCommentCount(comments.length);
    onCommentsChanged?.(comments);
  }

  if (!errorLog) return null;

  return (
    <div className="c-detail-drawer">
      <div className="drawer-header">
        <div className="drawer-heading">
          <span className="reference-id">{errorLog.reference_id}</span>
          <h2>{errorLog.title}</h2>
        </div>
        <button className="btn-icon" aria-label="Close" onClick={onClose}>
          <i className="material-icons">close</i>
        </button>
      </div>

      <div className="drawer-body">
        <div className="drawer-content">
          <div className="meta-row">
            <span
              className={
                'type-badge' +
                (errorLog.log_type === 'Feature' ? ' type-badge--feature' : '') +
                (errorLog.log_type === 'Suggestion' ? ' type-badge--suggestion' : '')
              }
            >
              {errorLog.log_type}
            </span>
            <StatusBadge status={errorLog.status} />
            <span className={`priority priority-${errorLog.priority}`}>{errorLog.priority} priority</span>
            <span className="environment-badge">{errorLog.environment}</span>
          </div>

          <dl className="meta-grid">
            <dt>Status</dt>
            <dd>{STATUS_LABELS[errorLog.status]}</dd>

            <dt>Screen</dt>
            <dd>{errorLog.screen?.name ?? errorLog.screen_name_freetext ?? '—'}</dd>

            <dt>Reported by</dt>
            <dd>{errorLog.reported_by.name}</dd>

            <dt>Assigned to</dt>
            <dd>{errorLog.assigned_to?.name ?? 'Unassigned'}</dd>

            <dt>Created</dt>
            <dd>{formatDate(errorLog.created_at, 'medium')}</dd>

            <dt>Updated</dt>
            <dd>{formatDate(errorLog.updated_at, 'medium')}</dd>
          </dl>

          <h3>Description</h3>
          {/* Description is rich text authored in Quill by an authenticated team member. */}
          <div className="description" dangerouslySetInnerHTML={{ __html: errorLog.description }} />

          <h3>Attachments</h3>
          {previews.length === 0 ? (
            <p className="empty">No attachments.</p>
          ) : (
            <div className="attachment-grid">
              {previews.map((preview) => (
                <div key={preview.attachment.id} className="attachment-card">
                  {preview.isImage && preview.objectUrl ? (
                    <img src={preview.objectUrl} alt={preview.attachment.original_filename} />
                  ) : (
                    <div className="file-icon">
                      <i className="material-icons">description</i>
                    </div>
                  )}
                  <div className="attachment-name" title={preview.attachment.original_filename}>
                    {preview.attachment.original_filename}
                  </div>
                  <div className="attachment-actions">
                    {preview.isImage && preview.objectUrl && (
                      <button className="btn btn-sm btn-ghost" onClick={() => openViewer(preview)}>
                        View
                      </button>
                    )}
                    <button className="btn btn-sm btn-ghost" onClick={() => download(preview.attachment)}>
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-sm btn-ghost comments-btn" onClick={() => setCommentsOpen(true)}>
            <i className="material-icons">chat_bubble_outline</i>
            Comments
            {commentCount > 0 && <span className="comments-count">{commentCount}</span>}
          </button>
        </div>
      </div>

      {commentsOpen && (
        <CommentsModal
          errorLog={errorLog}
          onClose={() => setCommentsOpen(false)}
          onCommentsChanged={handleCommentsChanged}
        />
      )}

      {viewerImage && (
        <div className="image-viewer-backdrop" onClick={closeViewer}>
          <button className="btn-icon viewer-close" aria-label="Close viewer" onClick={closeViewer}>
            <i className="material-icons">close</i>
          </button>

          {images.length > 1 && (
            <button
              className="btn-icon viewer-nav viewer-prev"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                showPrevImage();
              }}
            >
              <i className="material-icons">chevron_left</i>
            </button>
          )}

          <div className="viewer-content" onClick={(e) => e.stopPropagation()}>
            <img src={viewerImage.objectUrl ?? ''} alt={viewerImage.attachment.original_filename} />
            <div className="viewer-caption">
              <span className="viewer-filename">{viewerImage.attachment.original_filename}</span>
              {images.length > 1 && (
                <span className="viewer-counter">
                  {(viewerIndex ?? 0) + 1} / {images.length}
                </span>
              )}
            </div>
          </div>

          {images.length > 1 && (
            <button
              className="btn-icon viewer-nav viewer-next"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                showNextImage();
              }}
            >
              <i className="material-icons">chevron_right</i>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
