import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  Attachment,
  ErrorLogCreateRequest,
  ErrorLogDetail,
  ErrorLogListItem,
  ErrorLogUpdateRequest,
  ErrorStatus,
} from '../models/error-log.model';

export interface ErrorLogFilters {
  status_filter?: ErrorStatus;
  screen_id?: number;
  assigned_to_id?: string;
  priority?: string;
}

@Injectable({ providedIn: 'root' })
export class ErrorLogsService {
  private readonly base = `${environment.apiUrl}/error-logs`;

  constructor(private readonly http: HttpClient) {}

  list(filters: ErrorLogFilters = {}): Observable<ErrorLogListItem[]> {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params[key] = String(value);
      }
    });
    return this.http.get<ErrorLogListItem[]>(this.base, { params });
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
}
