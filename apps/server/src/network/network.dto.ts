import { createZodDto } from 'nestjs-zod';
import { updateNetworkRequestSchema } from '@voids/shared';

/** Body for `PUT /api/network` (validated by the shared zod schema). */
export class UpdateNetworkDto extends createZodDto(updateNetworkRequestSchema) {}
