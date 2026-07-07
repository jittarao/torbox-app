'use client';

import Tooltip from '@/components/shared/Tooltip';
import { timeAgo } from '@/components/downloads/utils/formatters';
import { parseUtcDate } from '@/utils/parseUtcDate';

function formatHumanDate(at) {
  if (at == null || at === '') return null;

  try {
    const date = parseUtcDate(at);
    if (isNaN(date.getTime())) return null;

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return null;
  }
}

export default function TimeAgoWithTooltip({ at, t, fallback = '-' }) {
  if (at == null || at === '') {
    return fallback;
  }

  const date = parseUtcDate(at);
  if (isNaN(date.getTime())) {
    return fallback;
  }

  const humanDate = formatHumanDate(at);

  return (
    <Tooltip content={humanDate}>
      <span className="cursor-default">{timeAgo(date, t)}</span>
    </Tooltip>
  );
}
