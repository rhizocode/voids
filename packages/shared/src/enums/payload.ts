import { z } from 'zod';

/**
 * The numeric result-code catalog, ported 1:1 from Gaps so the UI's status
 * handling matches. Exported as a const object plus a zod enum of the codes.
 */
export interface PayloadEntry {
  readonly code: number;
  readonly reason: string;
}

export const Payload = {
  UNKNOWN_ERROR: { code: -1, reason: 'Unknown error.' },
  SEARCH_SUCCESSFUL: { code: 0, reason: 'Search successful.' },
  SEARCH_CANCELLED: { code: 1, reason: 'Search cancelled.' },
  SEARCH_FAILED: { code: 2, reason: 'Search failed. Check docker Gaps log file.' },
  OWNED_MOVIES_CANNOT_BE_EMPTY: {
    code: 3,
    reason: 'Owned movies list cannot be empty. You must search first.',
  },
  PLEX_CONNECTION_SUCCEEDED: { code: 10, reason: 'Connection to Plex succeeded.' },
  PLEX_CONNECTION_FAILED: { code: 11, reason: 'Connection to Plex failed.' },
  PARSING_PLEX_FAILED: { code: 12, reason: 'Failed to parse Plex XML.' },
  PLEX_URL_ERROR: { code: 13, reason: 'Error with plex Url' },
  PLEX_LIBRARIES_FOUND: { code: 13, reason: 'Plex Libraries found.' },
  DUPLICATE_PLEX_LIBRARY: { code: 14, reason: 'Attempted to add duplicate Plex library' },
  TMDB_KEY_VALID: { code: 20, reason: 'TMDB Key valid.' },
  TMDB_KEY_INVALID: { code: 21, reason: 'TMDB Key invalid' },
  TMDB_CONNECTION_ERROR: { code: 22, reason: 'Error connecting to TMDB with url' },
  TMDB_KEY_SAVE_SUCCESSFUL: { code: 23, reason: 'TMDB key saved.' },
  TMDB_KEY_SAVE_UNSUCCESSFUL: { code: 24, reason: 'TMDB key not saved.' },
  NUKE_SUCCESSFUL: { code: 30, reason: 'Nuke successful. All files deleted.' },
  NUKE_UNSUCCESSFUL: { code: 31, reason: 'Nuke unsuccessful. Manually delete files.' },
  PLEX_LIBRARY_MOVIE_FOUND: { code: 40, reason: "Plex's library movies found." },
  PLEX_LIBRARY_MOVIE_NOT_FOUND: { code: 41, reason: "Plex's library movies not found." },
  RECOMMENDED_MOVIES_FOUND: { code: 50, reason: 'Recommended movies found.' },
  RECOMMENDED_MOVIES_NOT_FOUND: { code: 51, reason: 'Recommended movies not found.' },
  SCHEDULE_FOUND: { code: 60, reason: 'Search schedule found.' },
  SCHEDULE_NOT_FOUND: { code: 61, reason: 'Search schedule not found.' },
  SCHEDULE_UPDATED: { code: 62, reason: 'Search schedule updated successfully.' },
  SCHEDULE_NOT_UPDATED: { code: 63, reason: 'Search schedule update failed.' },
  NOTIFICATION_TEST_SUCCEEDED: { code: 70, reason: 'Notification test succeeded.' },
  NOTIFICATION_TEST_FAILED: { code: 71, reason: 'Notification test failed.' },
  TELEGRAM_NOTIFICATION_UPDATE_SUCCEEDED: {
    code: 80,
    reason: 'Telegram Notification Update Succeeded.',
  },
  TELEGRAM_NOTIFICATION_UPDATE_FAILED: { code: 81, reason: 'Telegram Notification Update Failed.' },
  TELEGRAM_NOTIFICATION_FOUND: { code: 82, reason: 'Telegram Notification Found.' },
  TELEGRAM_NOTIFICATION_NOT_FOUND: { code: 83, reason: 'Telegram Notification Not Found.' },
  SLACK_NOTIFICATION_UPDATE_SUCCEEDED: { code: 90, reason: 'Slack Notification Update Succeeded.' },
  SLACK_NOTIFICATION_UPDATE_FAILED: { code: 91, reason: 'Slack Notification Update Failed.' },
  SLACK_NOTIFICATION_FOUND: { code: 92, reason: 'Slack Notification Found.' },
  SLACK_NOTIFICATION_NOT_FOUND: { code: 93, reason: 'Slack Notification Not Found.' },
  PUSH_BULLET_NOTIFICATION_UPDATE_SUCCEEDED: {
    code: 100,
    reason: 'PushBullet Notification Update Succeeded.',
  },
  PUSH_BULLET_NOTIFICATION_UPDATE_FAILED: {
    code: 101,
    reason: 'PushBullet Notification Update Failed.',
  },
  PUSH_BULLET_NOTIFICATION_FOUND: { code: 102, reason: 'PushBullet Notification Found.' },
  PUSH_BULLET_NOTIFICATION_NOT_FOUND: { code: 103, reason: 'PushBullet Notification Not Found.' },
  GOTIFY_NOTIFICATION_UPDATE_SUCCEEDED: {
    code: 110,
    reason: 'Gotify Notification Update Succeeded.',
  },
  GOTIFY_NOTIFICATION_UPDATE_FAILED: { code: 111, reason: 'Gotify Notification Update Failed.' },
  GOTIFY_NOTIFICATION_FOUND: { code: 112, reason: 'Gotify Notification Found.' },
  GOTIFY_NOTIFICATION_NOT_FOUND: { code: 113, reason: 'Gotify Notification Not Found.' },
  EMAIL_NOTIFICATION_UPDATE_SUCCEEDED: { code: 120, reason: 'Email Notification Update Succeeded.' },
  EMAIL_NOTIFICATION_UPDATE_FAILED: { code: 121, reason: 'Email Notification Update Failed.' },
  EMAIL_NOTIFICATION_FOUND: { code: 122, reason: 'Email Notification Found.' },
  EMAIL_NOTIFICATION_NOT_FOUND: { code: 123, reason: 'Email Notification Not Found.' },
  PUSH_OVER_NOTIFICATION_UPDATE_SUCCEEDED: {
    code: 130,
    reason: 'PushOver Notification Update Succeeded.',
  },
  PUSH_OVER_NOTIFICATION_UPDATE_FAILED: {
    code: 131,
    reason: 'PushOver Notification Update Failed.',
  },
  PUSH_OVER_NOTIFICATION_FOUND: { code: 132, reason: 'PushOver Notification Found.' },
  PUSH_OVER_NOTIFICATION_NOT_FOUND: { code: 133, reason: 'PushOver Notification Not Found.' },
  DISCORD_NOTIFICATION_UPDATE_SUCCEEDED: {
    code: 140,
    reason: 'Discord Notification Update Succeeded.',
  },
  DISCORD_NOTIFICATION_UPDATE_FAILED: { code: 141, reason: 'Discord Notification Update Failed.' },
  DISCORD_NOTIFICATION_FOUND: { code: 142, reason: 'Discord Notification Found.' },
  DISCORD_NOTIFICATION_NOT_FOUND: { code: 143, reason: 'Discord Notification Not Found.' },
  MOVIE_STATUS_FOUND: { code: 150, reason: 'Movie status found.' },
  MOVIE_STATUS_NOT_FOUND: { code: 151, reason: 'Movie status not found.' },
  MOVIE_STATUS_UPDATED: { code: 152, reason: 'Movie status updated successfully.' },
  MOVIE_STATUS_NOT_UPDATED: { code: 153, reason: 'Movie status update failed.' },
} as const satisfies Record<string, PayloadEntry>;

export type PayloadName = keyof typeof Payload;

/** All distinct payload codes. */
export const payloadCodes: number[] = Object.values(Payload).map((p) => p.code);

export const payloadCodeSchema = z
  .number()
  .refine((c) => payloadCodes.includes(c), { message: 'Unknown payload code' });

/** Look up a payload entry by its code (returns the first match). */
export function payloadByCode(code: number): PayloadEntry | undefined {
  return Object.values(Payload).find((p) => p.code === code);
}
