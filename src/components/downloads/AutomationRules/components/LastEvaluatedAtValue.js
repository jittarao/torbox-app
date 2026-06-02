'use client';

import Tooltip from '@/components/shared/Tooltip';
import { timeAgo } from '@/components/downloads/utils/formatters';
import { parseAutomationTimestamp } from '../utils';

export default function LastEvaluatedAtValue({ at, commonT, fallback }) {
  const date = parseAutomationTimestamp(at);
  if (!date) {
    return fallback ?? at ?? null;
  }

  return (
    <Tooltip content={date.toLocaleString()}>
      <span className="cursor-default">{timeAgo(date, commonT)}</span>
    </Tooltip>
  );
}
