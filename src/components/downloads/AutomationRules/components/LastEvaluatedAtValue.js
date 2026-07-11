'use client';

import TimeAgoWithTooltip from '@/components/shared/TimeAgoWithTooltip';

export default function LastEvaluatedAtValue({ at, commonT, fallback }) {
  return <TimeAgoWithTooltip at={at} t={commonT} fallback={fallback} />;
}
