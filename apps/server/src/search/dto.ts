import { createZodDto } from 'nestjs-zod';
import {
  bulkUpdateRecommendationRequestSchema,
  updateRecommendationRequestSchema,
} from '@voids/shared';

/** Nest DTO classes derived from the shared zod schemas (for ZodValidationPipe). */
export class UpdateRecommendationDto extends createZodDto(
  updateRecommendationRequestSchema,
) {}
export class BulkUpdateRecommendationDto extends createZodDto(
  bulkUpdateRecommendationRequestSchema,
) {}
