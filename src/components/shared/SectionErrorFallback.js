'use client';

import { useTranslations } from 'next-intl';
import SectionErrorFallbackView from '@/components/shared/SectionErrorFallbackView';

/**
 * Inline fallback when a section error boundary catches a render error (locale routes).
 */
export default function SectionErrorFallback(props) {
  const t = useTranslations('ErrorBoundary');

  return (
    <SectionErrorFallbackView
      title={props.title ?? t('title')}
      messageFallback={t('sectionMessage')}
      tryAgainLabel={t('tryAgain')}
      reloadLabel={t('reloadPage')}
      {...props}
    />
  );
}
