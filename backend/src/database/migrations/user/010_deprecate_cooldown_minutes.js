/**
 * Deprecate cooldown_minutes column in automation_rules
 * 
 * The cooldown_minutes field is now deprecated. Cooldown is handled at the user-level
 * polling (5-minute minimum between polls) instead of per-rule cooldown.
 * 
 * We keep the column for backward compatibility but it is no longer used.
 * It can be removed in a future migration if needed.
 */
export const up = (db) => {
    // Mark all existing cooldown_minutes values as 0 (deprecated)
    // This ensures consistency - the field exists but is not used
    db.prepare(`
      UPDATE automation_rules 
      SET cooldown_minutes = 0
      WHERE cooldown_minutes IS NOT NULL AND cooldown_minutes != 0
    `).run();
    
    // Note: We keep the column for backward compatibility
    // The application code now ignores this field
  };
  
  export const down = (db) => {
    // No rollback needed - column still exists
    // If we need to restore old behavior, we would need to restore the old code
    // that checked cooldown_minutes, but that's not recommended
  };