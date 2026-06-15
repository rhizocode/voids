import { z } from 'zod';
import { authModeSchema } from '../domain/settings';

/**
 * Response for `GET /api/auth/mode`. Tells the UI whether auth is enabled so it
 * can adjust its behavior. Never leaks the username or password.
 */
export const authModeResponseSchema = z.object({
  mode: authModeSchema,
});
export type AuthModeResponse = z.infer<typeof authModeResponseSchema>;
