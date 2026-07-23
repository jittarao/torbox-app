/**
 * Static imports so static analysis can trace migration modules.
 * Runtime migration execution still uses dynamic import() in MigrationRunner.
 */

import * as master000_migrations_table from './master/000_migrations_table.js';
import * as master001_master_user_registry from './master/001_master_user_registry.js';
import * as master002_add_upload_counters from './master/002_add_upload_counters.js';
import * as master003_consecutive_auth_failures from './master/003_consecutive_auth_failures.js';
import * as master004_pending_actions from './master/004_pending_actions.js';
import * as master005_fix_poll_timestamp from './master/005_fix_poll_timestamp.js';
import * as master006_consecutive_plan_restricted_failures from './master/006_consecutive_plan_restricted_failures.js';
import * as master007_pending_actions_created_at_index from './master/007_pending_actions_created_at_index.js';
import * as master008_user_registry_upload_queues from './master/008_user_registry_upload_queues.js';
import * as master009_user_upload_tier_and_quota from './master/009_user_upload_tier_and_quota.js';
import * as master010_user_last_seen_at from './master/010_user_last_seen_at.js';
import * as user000_migrations_table from './user/000_migrations_table.js';
import * as user001_automation_rules_schema from './user/001_automation_rules_schema.js';
import * as user002_torrent_shadow_schema from './user/002_torrent_shadow_schema.js';
import * as user003_torrent_telemetry_schema from './user/003_torrent_telemetry_schema.js';
import * as user004_speed_history_schema from './user/004_speed_history_schema.js';
import * as user005_archived_downloads_schema from './user/005_archived_downloads_schema.js';
import * as user006_custom_views_schema from './user/006_custom_views_schema.js';
import * as user007_tags_schema from './user/007_tags_schema.js';
import * as user008_download_tags_schema from './user/008_download_tags_schema.js';
import * as user009_add_last_evaluated_at from './user/009_add_last_evaluated_at.js';
import * as user010_deprecate_cooldown_minutes from './user/010_deprecate_cooldown_minutes.js';
import * as user011_uploads_schema from './user/011_uploads_schema.js';
import * as user012_upload_attempts_schema from './user/012_upload_attempts_schema.js';
import * as user013_link_history_schema from './user/013_link_history_schema.js';
import * as user014_unique_archived_downloads from './user/014_unique_archived_downloads.js';
import * as user015_custom_views_search_query from './user/015_custom_views_search_query.js';
import * as user016_link_history_status from './user/016_link_history_status.js';
import * as user017_automation_rules_asset_types from './user/017_automation_rules_asset_types.js';
import * as user018_upload_torbox_result from './user/018_upload_torbox_result.js';
import * as user019_upload_file_size from './user/019_upload_file_size.js';
import * as user020_protected_downloads_schema from './user/020_protected_downloads_schema.js';
import * as user021_custom_views_sort_order from './user/021_custom_views_sort_order.js';
import * as user022_upload_attempts_is_cached from './user/022_upload_attempts_is_cached.js';

/** Keeps migration exports reachable for static analysis (see MigrationRunner). */
export const MIGRATION_MODULE_BINDINGS = [
  master000_migrations_table,
  master001_master_user_registry,
  master002_add_upload_counters,
  master003_consecutive_auth_failures,
  master004_pending_actions,
  master005_fix_poll_timestamp,
  master006_consecutive_plan_restricted_failures,
  master007_pending_actions_created_at_index,
  master008_user_registry_upload_queues,
  master009_user_upload_tier_and_quota,
  master010_user_last_seen_at,
  user000_migrations_table,
  user001_automation_rules_schema,
  user002_torrent_shadow_schema,
  user003_torrent_telemetry_schema,
  user004_speed_history_schema,
  user005_archived_downloads_schema,
  user006_custom_views_schema,
  user007_tags_schema,
  user008_download_tags_schema,
  user009_add_last_evaluated_at,
  user010_deprecate_cooldown_minutes,
  user011_uploads_schema,
  user012_upload_attempts_schema,
  user013_link_history_schema,
  user014_unique_archived_downloads,
  user015_custom_views_search_query,
  user016_link_history_status,
  user017_automation_rules_asset_types,
  user018_upload_torbox_result,
  user019_upload_file_size,
  user020_protected_downloads_schema,
  user021_custom_views_sort_order,
  user022_upload_attempts_is_cached,
];
