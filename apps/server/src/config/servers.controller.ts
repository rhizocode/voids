import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  Payload,
  type LibraryResponse,
  type LibrariesResponse,
  type MediaServerView,
  type ServerTestResponse,
} from '@voids/shared';
import { ServersService, ServerConnectionError } from './servers.service';
import { AddServerDto, UpdateLibraryDto } from './dto';

@Controller('api')
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Get('servers')
  list(): MediaServerView[] {
    return this.servers.listServerViews();
  }

  @Post('servers')
  async add(@Body() body: AddServerDto): Promise<MediaServerView> {
    try {
      return await this.servers.addServer(body);
    } catch (err) {
      if (err instanceof ServerConnectionError) {
        // Reuse the generic connection-failed payload as a 400 body.
        throw new HttpException(
          { ...Payload.PLEX_CONNECTION_FAILED, reason: err.message },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw err;
    }
  }

  @Put('servers/:id/test')
  async test(@Param('id') id: string): Promise<ServerTestResponse> {
    try {
      await this.servers.testServer(id);
      return { ...Payload.PLEX_CONNECTION_SUCCEEDED };
    } catch (err) {
      const reason = err instanceof Error ? err.message : Payload.PLEX_CONNECTION_FAILED.reason;
      return { ...Payload.PLEX_CONNECTION_FAILED, reason };
    }
  }

  @Delete('servers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    this.servers.deleteServer(id);
  }

  @Put('servers/:id/libraries/:key')
  updateLibrary(
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() body: UpdateLibraryDto,
  ): LibraryResponse {
    const updated = this.servers.updateLibrary(id, key, body);
    if (!updated) {
      throw new NotFoundException(`No library ${key} on server ${id}`);
    }
    return updated;
  }

  @Get('libraries')
  libraries(): LibrariesResponse {
    return this.servers.listAllLibraries();
  }
}
