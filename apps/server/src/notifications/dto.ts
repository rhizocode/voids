import { createZodDto } from 'nestjs-zod';
import { updateNotificationRequestSchema } from '@voids/shared';

/** Nest DTO derived from the shared zod schema (for ZodValidationPipe). */
export class UpdateNotificationDto extends createZodDto(updateNotificationRequestSchema) {}
