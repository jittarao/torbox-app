'use client';

import { useCallback, useState } from 'react';
import { getJSON, setJSON } from '@/utils/storage';

const STORAGE_KEY = 'torbox-filters-sidebar-sections';

const DEFAULT_SECTIONS = {
  views: true,
  tags: true,
  trackers: true,
  sources: true,
};

function readStoredSections() {
  const stored = getJSON(STORAGE_KEY);
  if (!stored || typeof stored !== 'object') return DEFAULT_SECTIONS;
  return { ...DEFAULT_SECTIONS, ...stored };
}

export default function useFiltersSidebarSectionsCollapsed() {
  const [sectionsExpanded, setSectionsExpanded] = useState(readStoredSections);

  const persistSections = useCallback((next) => {
    setSectionsExpanded(next);
    setJSON(STORAGE_KEY, next);
  }, []);

  const toggleSection = useCallback((sectionId) => {
    setSectionsExpanded((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      setJSON(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const expandAllSections = useCallback(() => {
    persistSections(DEFAULT_SECTIONS);
  }, [persistSections]);

  return { sectionsExpanded, toggleSection, expandAllSections };
}
