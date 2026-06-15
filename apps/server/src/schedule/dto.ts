import { createZodDto } from 'nestjs-zod';
import { updateScheduleRequestSchema, updateMovieStatusRequestSchema } from '@voids/shared';

/** Nest DTO classes derived from the shared zod schemas (for ZodValidationPipe). */
export class UpdateScheduleDto extends createZodDto(updateScheduleRequestSchema) {}
export class UpdateMovieStatusDto extends createZodDto(updateMovieStatusRequestSchema) {}
