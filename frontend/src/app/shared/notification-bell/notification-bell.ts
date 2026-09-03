import { DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { NotificationsService } from '../../core/services/notifications.service';
import { Notification } from '../../core/models/notification.model';

const POLL_INTERVAL_MS = 30_000;

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
})
export class NotificationBell implements OnInit, OnDestroy {
  open = signal(false);
  unreadCount = signal(0);
  notifications = signal<Notification[]>([]);

  private pollHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly router: Router,
    private readonly hostRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.refreshUnreadCount();
    this.pollHandle = setInterval(() => this.refreshUnreadCount(), POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.pollHandle);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.hostRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) {
      this.notificationsService.list().subscribe((list) => this.notifications.set(list));
    }
  }

  refreshUnreadCount(): void {
    this.notificationsService.unreadCount().subscribe((res) => this.unreadCount.set(res.count));
  }

  markAllRead(): void {
    this.notificationsService.markAllRead().subscribe(() => {
      this.notifications.set(this.notifications().map((n) => ({ ...n, is_read: true })));
      this.unreadCount.set(0);
    });
  }

  openNotification(notification: Notification): void {
    if (!notification.is_read) {
      this.notificationsService.markRead(notification.id).subscribe(() => {
        this.unreadCount.update((c) => Math.max(0, c - 1));
      });
      notification.is_read = true;
    }
    this.open.set(false);
    this.router.navigate(['/error-logs'], { queryParams: { open: notification.error_log_id } });
  }
}
