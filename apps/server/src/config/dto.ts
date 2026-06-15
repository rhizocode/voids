import { createZodDto } from 'nestjs-zod';
import {
  addServerRequestSchema,
  tmdbKeyRequestSchema,
  updateLibraryRequestSchema,
  updateSettingsRequestSchema,
} from '@voids/shared';

/** Nest DTO classes derived from the shared zod schemas (for ZodValidationPipe). */
export class UpdateSettingsDto extends createZodDto(updateSettingsRequestSchema) {}
export class TmdbKeyDto extends createZodDto(tmdbKeyRequestSchema) {}
export class AddServerDto extends createZodDto(addServerRequestSchema) {}
export class UpdateLibraryDto extends createZodDto(updateLibraryRequestSchema) {}
