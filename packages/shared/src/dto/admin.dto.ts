import { z } from 'zod';

/** Body for `POST /api/nuke`. Requires explicit confirmation to prevent accidental or cross-site triggers. */
export const nukeRequestSchema = z.object({
  confirm: z.literal('nuke'),
});
export type NukeRequest = z.infer<typeof nukeRequestSchema>;
