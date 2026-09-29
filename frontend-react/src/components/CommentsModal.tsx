import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type JSX } from 'react';

import { apiErrorMessage } from '@/api/client';
import { useDocumentEvent } from '@/hooks/useEventListener';
import { errorLogsService } from '@/services/errorLogs';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/stores/toast';
import type { Attachment, Comment, ErrorLogDetail } from '@/types/errorLog';
import { formatDate } from '@/utils/date';

/**
 * Chat-style "Comments" modal for an error log. Own messages render in a plain white bubble
 * on the right; everyone else's render in a grey bubble on the left, like a normal chat
 * thread. Kept as its own modal (rather than inline in the detail drawer) so the thread has
 * room to breathe.
 *
 * Attachments: files can be added via the paperclip button (multi-select) or by pasting an
 * image/file directly into the composer textarea (Ctrl+V) -- no separate drop zone, paste
 * just works wherever the cursor is. A comment is sent as two requests: the text first, then
 * any pending files uploaded against the new comment's id.
 */
interface Props {
  errorLog: ErrorLogDetail | null;
  onClose: () => void;
  onCommentsChanged: (comments: Comment[]) => void;
}

interface PendingFile {
  /** Stable key for React's list reconciliation -- File objects have no id of their own. */
  key: string;
  file: File;
  isImage: boolean;
  /** Only set for images -- a local object URL so the composer can show a thumbnail before send. */
  previewUrl: string | null;
}

let pendingFileKey = 0;

export default function CommentsModal({ errorLog, onClose, onCommentsChanged }: Props): JSX.Element {
  const currentUser = useAuthStore((s) => s.currentUser);

  const [comments, setComments] = useState<Comment[]>(errorLog?.comments ?? []);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [postingComment, setPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');

  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * Object URLs for already-posted image attachments, fetched lazily (the download route
   * needs an auth header, so a plain <img src> can't hit it directly). Keyed by attachment id.
   * The ref mirrors state so cleanup on unmount sees the latest map.
   */
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const imageUrlsRef = useRef(imageUrls);
  imageUrlsRef.current = imageUrls;

  const canComment = errorLog?.can_comment ?? false;
  const canSend = newCommentBody.trim().length > 0 || pendingFiles.length > 0;

  const loadImagePreviews = useCallback(async (attachments: Attachment[]): Promise<void> => {
    const pending = attachments.filter(
      (a) => a.content_type.startsWith('image/') && !imageUrlsRef.current[a.id],
    );
    await Promise.all(
      pending.map(async (attachment) => {
        try {
          const blob = await errorLogsService.fetchCommentAttachment(attachment.id);
          setImageUrls((urls) => ({ ...urls, [attachment.id]: URL.createObjectURL(blob) }));
        } catch {
          /* a failed thumbnail shouldn't break the thread -- the file row still downloads */
        }
      }),
    );
  }, []);

  useEffect(() => {
    const list = errorLog?.comments ?? [];
    setComments(list);
    void loadImagePreviews(list.flatMap((c) => c.attachments));
  }, [errorLog, loadImagePreviews]);

  // Revoke every object URL this modal created, once, on unmount.
  useEffect(
    () => () => {
      Object.values(imageUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  useDocumentEvent('keydown', (event) => {
    if (event.key === 'Escape') onClose();
  });

  function isOwn(comment: Comment): boolean {
    return currentUser?.id === comment.author.id;
  }

  function canEditComment(comment: Comment): boolean {
    if (!currentUser) return false;
    return currentUser.role === 'SuperAdmin' || comment.author.id === currentUser.id;
  }

  // ---- Attaching files before send ----

  function addPendingFiles(files: File[]): void {
    const additions: PendingFile[] = files.map((file) => {
      const isImage = file.type.startsWith('image/');
      return {
        key: `pending-${pendingFileKey++}`,
        file,
        isImage,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
      };
    });
    setPendingFiles((list) => [...list, ...additions]);
  }

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>): void {
    addPendingFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  /**
   * Handles Ctrl+V anywhere in the composer -- any file/image in the clipboard is queued as
   * an attachment; plain text pastes through to the textarea as normal.
   */
  function onComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>): void {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      event.preventDefault();
      addPendingFiles(files);
    }
  }

  function removePendingFile(pending: PendingFile): void {
    if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPendingFiles((list) => list.filter((p) => p.key !== pending.key));
  }

  function clearPendingFiles(current: PendingFile[]): void {
    current.forEach((p) => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    setPendingFiles([]);
  }

  // ---- Sending ----

  function appendComment(comment: Comment): void {
    setComments((list) => {
      const updated = [...list, comment];
      onCommentsChanged(updated);
      return updated;
    });
    void loadImagePreviews(comment.attachments);
  }

  async function addComment(): Promise<void> {
    if (!errorLog || !canSend) return;

    const body = newCommentBody.trim();
    const queued = pendingFiles;
    const filesToUpload = queued.map((p) => p.file);

    setPostingComment(true);
    let comment: Comment;
    try {
      comment = await errorLogsService.addComment(errorLog.id, body);
    } catch (err) {
      setPostingComment(false);
      toast.show(apiErrorMessage(err, 'Failed to post comment'), 'error');
      return;
    }

    setNewCommentBody('');
    clearPendingFiles(queued);

    if (filesToUpload.length === 0) {
      setPostingComment(false);
      appendComment(comment);
      return;
    }

    try {
      const attachments = await errorLogsService.uploadCommentAttachments(errorLog.id, comment.id, filesToUpload);
      appendComment({ ...comment, attachments });
    } catch (err) {
      appendComment(comment);
      toast.show(apiErrorMessage(err, 'Comment posted, but attachments failed to upload'), 'error');
    } finally {
      setPostingComment(false);
    }
  }

  function startEditComment(comment: Comment): void {
    setEditingCommentId(comment.id);
    setEditingCommentBody(comment.body);
  }

  function cancelEditComment(): void {
    setEditingCommentId(null);
    setEditingCommentBody('');
  }

  async function saveEditComment(comment: Comment): Promise<void> {
    if (!errorLog) return;
    const body = editingCommentBody.trim();
    if (!body && comment.attachments.length === 0) return;

    try {
      const updated = await errorLogsService.updateComment(errorLog.id, comment.id, body);
      setComments((list) => {
        const next = list.map((c) => (c.id === updated.id ? updated : c));
        onCommentsChanged(next);
        return next;
      });
      cancelEditComment();
    } catch (err) {
      toast.show(apiErrorMessage(err, 'Failed to update comment'), 'error');
    }
  }

  async function deleteComment(comment: Comment): Promise<void> {
    if (!errorLog || !confirm('Delete this comment?')) return;

    try {
      await errorLogsService.deleteComment(errorLog.id, comment.id);
      setComments((list) => {
        const next = list.filter((c) => c.id !== comment.id);
        onCommentsChanged(next);
        return next;
      });
    } catch (err) {
      toast.show(apiErrorMessage(err, 'Failed to delete comment'), 'error');
    }
  }

  async function download(attachment: Attachment): Promise<void> {
    const blob = await errorLogsService.fetchCommentAttachment(attachment.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.original_filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="c-comments-modal">
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-panel comments-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-topbar">
            <span className="modal-title">Comments</span>
            <button className="btn-icon" type="button" aria-label="Close" onClick={onClose}>
              <i className="material-icons">close</i>
            </button>
          </div>

          <div className="chat-body">
            {comments.length === 0 && <p className="empty">No comments yet.</p>}

            {comments.map((comment) => (
              <div key={comment.id} className={`chat-row${isOwn(comment) ? ' chat-row--own' : ''}`}>
                <div className={`chat-bubble${isOwn(comment) ? ' chat-bubble--own' : ''}`}>
                  {!isOwn(comment) && <span className="chat-author">{comment.author.name}</span>}

                  {editingCommentId === comment.id ? (
                    <div className="chat-edit">
                      <textarea
                        rows={3}
                        value={editingCommentBody}
                        onChange={(e) => setEditingCommentBody(e.target.value)}
                      />
                      <div className="chat-edit-actions">
                        <button className="btn btn-sm btn-primary" onClick={() => saveEditComment(comment)}>
                          Save
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={cancelEditComment}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {comment.body && <p className="chat-text">{comment.body}</p>}

                      {comment.attachments.length > 0 && (
                        <div className="chat-attachments">
                          {comment.attachments.map((attachment) =>
                            attachment.content_type.startsWith('image/') && imageUrls[attachment.id] ? (
                              <img
                                key={attachment.id}
                                className="chat-attachment-image"
                                src={imageUrls[attachment.id]}
                                alt={attachment.original_filename}
                                onClick={() => download(attachment)}
                              />
                            ) : (
                              <button
                                key={attachment.id}
                                className="chat-attachment-file"
                                type="button"
                                title={attachment.original_filename}
                                onClick={() => download(attachment)}
                              >
                                <i className="material-icons">description</i>
                                <span>{attachment.original_filename}</span>
                              </button>
                            ),
                          )}
                        </div>
                      )}

                      <div className="chat-footer">
                        <span className="chat-meta">
                          {formatDate(comment.created_at, 'short')}
                          {comment.edited_at && <span className="chat-edited">(edited)</span>}
                        </span>
                        {canEditComment(comment) && (
                          <span className="chat-actions">
                            <button
                              className="btn-icon"
                              title="Edit comment"
                              onClick={() => startEditComment(comment)}
                            >
                              <i className="material-icons">edit</i>
                            </button>
                            <button className="btn-icon" title="Delete comment" onClick={() => deleteComment(comment)}>
                              <i className="material-icons">delete</i>
                            </button>
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {canComment ? (
            <div className="chat-composer">
              {pendingFiles.length > 0 && (
                <div className="pending-files">
                  {pendingFiles.map((pending) => (
                    <div key={pending.key} className="pending-file">
                      {pending.isImage && pending.previewUrl ? (
                        <img src={pending.previewUrl} alt={pending.file.name} />
                      ) : (
                        <i className="material-icons">description</i>
                      )}
                      <span className="pending-file-name" title={pending.file.name}>
                        {pending.file.name}
                      </span>
                      <button
                        className="btn-icon"
                        type="button"
                        title="Remove"
                        onClick={() => removePendingFile(pending)}
                      >
                        <i className="material-icons">close</i>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="chat-composer-row">
                <input ref={fileInput} type="file" multiple hidden onChange={onFilesSelected} />
                <button
                  className="btn-icon attach-btn"
                  type="button"
                  title="Attach files"
                  onClick={() => fileInput.current?.click()}
                >
                  <i className="material-icons">attach_file</i>
                </button>
                <textarea
                  rows={2}
                  placeholder="Add a comment, or paste an image/file directly..."
                  value={newCommentBody}
                  onChange={(e) => setNewCommentBody(e.target.value)}
                  onPaste={onComposerPaste}
                />
                <button
                  className="btn btn-sm btn-primary"
                  disabled={!canSend || postingComment}
                  onClick={addComment}
                >
                  <i className="material-icons">send</i>
                </button>
              </div>
            </div>
          ) : (
            <p className="chat-permission-hint">
              Only the reporter, a current or past assignee, or a SuperAdmin can comment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
