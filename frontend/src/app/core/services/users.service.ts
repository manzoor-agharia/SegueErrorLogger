import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { User, UserRole } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users`);
  }

  updateRole(userId: string, role: UserRole): Observable<User> {
    return this.http.put<User>(`${environment.apiUrl}/users/${userId}/role`, { role });
  }
}
