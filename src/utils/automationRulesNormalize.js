/**
 * Minimum interval for automation rules (minutes).
 * Must stay aligned with backend `MIN_INTERVAL_MINUTES` in
 * `backend/src/automation/helpers/constants.js`.
 */
export const MIN_AUTOMATION_INTERVAL_MINUTES = 30;

/**
 * Clamp interval trigger values so saves pass backend validation.
 * Legacy rules may still have values below the current minimum.
 */
export function normalizeAutomationRulesForSave(rules) {
  if (!Array.isArray(rules)) return rules;

  return rules.map((rule) => {
    const trigger = rule?.trigger;
    if (!trigger || trigger.type !== 'interval') {
      return rule;
    }

    const raw = trigger.value;
    const n = raw == null ? NaN : typeof raw === 'number' ? raw : Number(raw);
    const floored = Number.isFinite(n) ? Math.floor(n) : NaN;
    const clamped =
      Number.isFinite(floored) && floored >= MIN_AUTOMATION_INTERVAL_MINUTES
        ? floored
        : MIN_AUTOMATION_INTERVAL_MINUTES;

    if (clamped === trigger.value && typeof trigger.value === 'number') {
      return rule;
    }

    return {
      ...rule,
      trigger: {
        ...trigger,
        value: clamped,
      },
    };
  });
}
