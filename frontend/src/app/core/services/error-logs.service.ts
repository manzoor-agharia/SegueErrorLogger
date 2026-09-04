import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  Attachment,
  Comment,
  ErrorLogCreateRequest,
  ErrorLogDetail,
  ErrorLogPage,
  ErrorLogUpdateRequest,
  ErrorStatus,
} from '../models/error-log.model';

/** Sentinel passed as the `assigned_to_id` filter value to mean "no assignee set". */
export const UNASSIGNED_FILTER_VALUE = 'unassigned';

export interface ErrorLogFilters {
  /** Comma-separated list of ErrorStatus values for multi-select filtering. */
  status_filter?: string;
  screen_id?: number;
  assigned_to_id?: string;
  /** Comma-separated list of ErrorPriority values for multi-select filtering. */
  priority?: string;
  environment?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

@Injectable({ providedIn: 'root' })
export class ErrorLogsService {
  private readonly base = `${environment.apiUrl}/error-logs`;

  constructor(private readonly http: HttpClient) {}

  list(filters: ErrorLogFilters = {}): Observable<ErrorLogPage> {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params[key] = String(value);
      }
    });
    return this.http.get<ErrorLogPage>(this.base, { params });
  }

  get(id: string): Observable<ErrorLogDetail> {
    return this.http.get<ErrorLogDetail>(`${this.base}/${id}`);
  }

  create(payload: ErrorLogCreateRequest): Observable<ErrorLogDetail> {
    return this.http.post<ErrorLogDetail>(this.base, payload);
  }

  update(id: string, payload: ErrorLogUpdateRequest): Observable<ErrorLogDetail> {
    return this.http.put<ErrorLogDetail>(`${this.base}/${id}`, payload);
  }

  updateStatus(id: string, status: ErrorStatus): Observable<ErrorLogDetail> {
    return this.http.patch<ErrorLogDetail>(`${this.base}/${id}/status`, { status });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  uploadAttachments(id: string, files: File[]): Observable<Attachment[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    return this.http.post<Attachment[]>(`${this.base}/${id}/attachments`, formData);
  }

  downloadUrl(attachmentId: string): string {
    return `${this.base}/attachments/${attachmentId}/download`;
  }

  addComment(id: string, body: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.base}/${id}/comments`, { body });
  }

  updateComment(id: string, commentId: string, body: string): Observable<Comment> {
    return this.http.put<Comment>(`${this.base}/${id}/comments/${commentId}`, { body });
  }

  deleteComment(id: string, commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/comments/${commentId}`);
  }
}
