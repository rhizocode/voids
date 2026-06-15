import { z } from 'zod';

/**
 * The shape returned by test/validation endpoints, mirroring Gaps' `Payload`
 * responses: a numeric `code`, a human `reason`, plus optional extras.
 */
export const payloadResultSchema = z
  .object({
    code: z.number().int(),
    reason: z.string(),
  })
  .passthrough();
export type PayloadResult = z.infer<typeof payloadResultSchema>;
