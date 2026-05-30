import { TAG_OPERATORS } from '@/components/downloads/AutomationRules/constants';

/** Operators that require selecting one or more specific tags. */
export function tagOperatorNeedsTagSelection(operator) {
  return (
    operator === TAG_OPERATORS.IS_ANY_OF ||
    operator === TAG_OPERATORS.IS_NONE_OF ||
    operator === TAG_OPERATORS.IS_ALL_OF
  );
}

/** Operators that match presence/absence of any tags (no tag IDs in value). */
export function isTagPresenceOperator(operator) {
  return operator === TAG_OPERATORS.IS_SET || operator === TAG_OPERATORS.IS_NOT_SET;
}
