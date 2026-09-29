import type { JSX } from 'react';

import { STATUS_LABELS, type ErrorStatus } from '@/types/errorLog';

export default function StatusBadge({ status }: { status: ErrorStatus }): JSX.Element {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}
