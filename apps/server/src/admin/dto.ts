import { createZodDto } from 'nestjs-zod';
import { nukeRequestSchema } from '@voids/shared';

export class NukeDto extends createZodDto(nukeRequestSchema) {}
