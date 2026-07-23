'use client';

import { useFilterEditorModal } from './useFilterEditorModal';
import FilterEditorModalBody from './FilterEditorModalBody';

/** @typedef {'create' | 'edit' | 'filter'} FilterModalMode */

export default function FilterEditorModal(props) {
  const state = useFilterEditorModal(props);
  if (!state.isOpen) return null;
  return <FilterEditorModalBody {...state} />;
}
