import { api, fetchBlob } from '@/api/client';
import type {
  Attachment,
  Comment,
  ErrorLogCreateRequest,
  ErrorLogDetail,
  ErrorLogPage,
  ErrorLogUpdateRequest,
  ErrorStatus,
} from '@/types/errorLog';

const BASE = '/error-logs';

/** Sentinel passed as the `assigned_to_id` filter value to mean "no assignee set". */
export const UNASSIGNED_FILTER_VALUE = 'unassigned';

export interface ErrorLogFilters {
  /** Comma-separated list of ErrorStatus values for multi-select filtering. */
  status_filter?: string;
  screen_id?: number | string;
  assigned_to_id?: string;
  /** Comma-separated list of ErrorPriority values for multi-select filtering. */
  priority?: string;
  environment?: string;
  /** Comma-separated list of LogType values for multi-select filtering. */
  log_type?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export const errorLogsService = {
  async list(filters: ErrorLogFilters = {}): Promise<ErrorLogPage> {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params[key] = String(value);
      }
    });
    const { data } = await api.get<ErrorLogPage>(BASE, { params });
    return data;
  },

  async get(id: string): Promise<ErrorLogDetail> {
    const { data } = await api.get<ErrorLogDetail>(`${BASE}/${id}`);
    return data;
  },

  async create(payload: ErrorLogCreateRequest): Promise<ErrorLogDetail> {
    const { data } = await api.post<ErrorLogDetail>(BASE, payload);
    return data;
  },

  async update(id: string, payload: ErrorLogUpdateRequest): Promise<ErrorLogDetail> {
    const { data } = await api.put<ErrorLogDetail>(`${BASE}/${id}`, payload);
    return data;
  },

  async updateStatus(id: string, status: ErrorStatus): Promise<ErrorLogDetail> {
    const { data } = await api.patch<ErrorLogDetail>(`${BASE}/${id}/status`, { status });
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },

  async uploadAttachments(id: string, files: File[]): Promise<Attachment[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    const { data } = await api.post<Attachment[]>(`${BASE}/${id}/attachments`, formData);
    return data;
  },

  downloadUrl(attachmentId: string): string {
    return `${BASE}/attachments/${attachmentId}/download`;
  },

  fetchAttachment(attachmentId: string): Promise<Blob> {
    return fetchBlob(this.downloadUrl(attachmentId));
  },

  async addComment(id: string, body: string): Promise<Comment> {
    const { data } = await api.post<Comment>(`${BASE}/${id}/comments`, { body });
    return data;
  },

  async updateComment(id: string, commentId: string, body: string): Promise<Comment> {
    const { data } = await api.put<Comment>(`${BASE}/${id}/comments/${commentId}`, { body });
    return data;
  },

  async deleteComment(id: string, commentId: string): Promise<void> {
    await api.delete(`${BASE}/${id}/comments/${commentId}`);
  },

  async uploadCommentAttachments(id: string, commentId: string, files: File[]): Promise<Attachment[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    const { data } = await api.post<Attachment[]>(`${BASE}/${id}/comments/${commentId}/attachments`, formData);
    return data;
  },

  commentAttachmentDownloadUrl(attachmentId: string): string {
    return `${BASE}/comments/attachments/${attachmentId}/download`;
  },

  fetchCommentAttachment(attachmentId: string): Promise<Blob> {
    return fetchBlob(this.commentAttachmentDownloadUrl(attachmentId));
  },
};
