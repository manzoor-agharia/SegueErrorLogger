import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { User, UserCreate, UserUpdate } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users`);
  }

  create(payload: UserCreate): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/users`, payload);
  }

  update(userId: string, payload: UserUpdate): Observable<User> {
    return this.http.put<User>(`${environment.apiUrl}/users/${userId}`, payload);
  }

  delete(userId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/users/${userId}`);
  }
}
