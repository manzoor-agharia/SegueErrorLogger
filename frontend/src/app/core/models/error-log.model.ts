import { User } from './user.model';

export type ErrorStatus = 'YetToStart' | 'InProgress' | 'Fixed' | 'TestedByQA' | 'Reopened' | 'Closed';
export type ErrorPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export const ERROR_STATUSES: ErrorStatus[] = [
  'YetToStart',
  'InProgress',
  'Fixed',
  'TestedByQA',
  'Reopened',
  'Closed',
];

export const ERROR_PRIORITIES: ErrorPriority[] = ['Low', 'Medium', 'High', 'Critical'];

export type ErrorEnvironment = 'Dev' | 'Staging' | 'Master' | 'QA' | 'Production';

export const ERROR_ENVIRONMENTS: ErrorEnvironment[] = ['Dev', 'Staging', 'Master', 'QA', 'Production'];

export const STATUS_LABELS: Record<ErrorStatus, string> = {
  YetToStart: 'Yet to Start',
  InProgress: 'In Progress',
  Fixed: 'Fixed',
  TestedByQA: 'Tested by QA',
  Reopened: 'Reopened',
  Closed: 'Closed',
};

export interface Screen {
  id: number;
  name: string;
  category: string;
}

export interface Attachment {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export interface StatusHistoryEntry {
  id: string;
  old_status: ErrorStatus | null;
  new_status: ErrorStatus;
  changed_by: User;
  changed_at: string;
}

export interface EditHistoryEntry {
  id: string;
  summary: string;
  changed_by: User;
  changed_at: string;
}

export interface Comment {
  id: string;
  body: string;
  author: User;
  created_at: string;
  edited_at: string | null;
}

export interface ErrorLogListItem {
  id: string;
  title: string;
  status: ErrorStatus;
  priority: ErrorPriority;
  environment: ErrorEnvironment;
  screen: Screen | null;
  screen_name_freetext: string | null;
  reported_by: User;
  assigned_to: User | null;
  created_at: string;
  updated_at: string;
}

export interface ErrorLogDetail extends ErrorLogListItem {
  description: string;
  attachments: Attachment[];
  status_history: StatusHistoryEntry[];
  edit_history: EditHistoryEntry[];
  comments: Comment[];
  /** Server-computed: true if the current user is the reporter, a current/past assignee, or a SuperAdmin. */
  can_comment: boolean;
}

export interface ErrorLogCreateRequest {
  title: string;
  description: string;
  screen_id?: number | null;
  screen_name_freetext?: string | null;
  priority: ErrorPriority;
  environment: ErrorEnvironment;
  assigned_to_id?: string | null;
}

export type ErrorLogUpdateRequest = Partial<ErrorLogCreateRequest>;

export interface ErrorLogPage {
  items: ErrorLogListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
