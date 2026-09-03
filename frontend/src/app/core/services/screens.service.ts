import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Screen } from '../models/error-log.model';

@Injectable({ providedIn: 'root' })
export class ScreensService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<Screen[]> {
    return this.http.get<Screen[]>(`${environment.apiUrl}/screens`);
  }
}
