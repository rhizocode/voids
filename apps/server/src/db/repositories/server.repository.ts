import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { MediaLibrary, MediaServer } from '@voids/shared';
import { DB } from '../db.module';
import type { DbHandle } from '../client';
import { libraries, mediaServers, ownedMovies, recommendedMovies, searchJobs } from '../schema';

type ServerRow = typeof mediaServers.$inferSelect;
type LibraryRow = typeof libraries.$inferSelect;

function toServer(row: ServerRow): MediaServer {
  return {
    id: row.id,
    type: row.type as MediaServer['type'],
    name: row.name ?? '',
    address: row.address,
    port: row.port,
    useHttps: row.useHttps,
    token: row.token ?? '',
  };
}

function toLibrary(row: LibraryRow): MediaLibrary {
  return {
    serverId: row.serverId,
    key: row.key,
    title: row.title ?? '',
    type: row.type ?? '',
    collectionType: row.collectionType,
    enabled: row.enabled,
    isDefault: row.isDefault,
  };
}

/** Repository for media servers and their libraries. */
@Injectable()
export class ServerRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  private get db() {
    return this.handle.db;
  }

  listServers(): MediaServer[] {
    return this.db.select().from(mediaServers).all().map(toServer);
  }

  findServer(id: string): MediaServer | undefined {
    const row = this.db.select().from(mediaServers).where(eq(mediaServers.id, id)).get();
    return row ? toServer(row) : undefined;
  }

  upsertServer(server: MediaServer): void {
    this.db
      .insert(mediaServers)
      .values({
        id: server.id,
        type: server.type,
        name: server.name,
        address: server.address,
        port: server.port,
        useHttps: server.useHttps,
        token: server.token,
      })
      .onConflictDoUpdate({
        target: mediaServers.id,
        set: {
          type: server.type,
          name: server.name,
          address: server.address,
          port: server.port,
          useHttps: server.useHttps,
          token: server.token,
        },
      })
      .run();
  }

  deleteServer(id: string): void {
    this.db.delete(libraries).where(eq(libraries.serverId, id)).run();
    this.db.delete(ownedMovies).where(eq(ownedMovies.serverId, id)).run();
    this.db.delete(recommendedMovies).where(eq(recommendedMovies.serverId, id)).run();
    this.db.delete(searchJobs).where(eq(searchJobs.serverId, id)).run();
    this.db.delete(mediaServers).where(eq(mediaServers.id, id)).run();
  }

  listLibraries(serverId?: string): MediaLibrary[] {
    const query = serverId
      ? this.db.select().from(libraries).where(eq(libraries.serverId, serverId))
      : this.db.select().from(libraries);
    return query.all().map(toLibrary);
  }

  findLibrary(serverId: string, key: string): MediaLibrary | undefined {
    const row = this.db
      .select()
      .from(libraries)
      .where(and(eq(libraries.serverId, serverId), eq(libraries.key, key)))
      .get();
    return row ? toLibrary(row) : undefined;
  }

  upsertLibrary(library: MediaLibrary): void {
    this.db
      .insert(libraries)
      .values({
        serverId: library.serverId,
        key: library.key,
        title: library.title,
        type: library.type,
        collectionType: library.collectionType,
        enabled: library.enabled,
        isDefault: library.isDefault,
      })
      .onConflictDoUpdate({
        target: [libraries.serverId, libraries.key],
        set: {
          title: library.title,
          type: library.type,
          collectionType: library.collectionType,
          enabled: library.enabled,
          isDefault: library.isDefault,
        },
      })
      .run();
  }

  updateLibraryFlags(
    serverId: string,
    key: string,
    flags: { enabled?: boolean; isDefault?: boolean },
  ): MediaLibrary | undefined {
    const set: Partial<Pick<LibraryRow, 'enabled' | 'isDefault'>> = {};
    if (flags.enabled !== undefined) set.enabled = flags.enabled;
    if (flags.isDefault !== undefined) set.isDefault = flags.isDefault;
    if (Object.keys(set).length > 0) {
      this.db
        .update(libraries)
        .set(set)
        .where(and(eq(libraries.serverId, serverId), eq(libraries.key, key)))
        .run();
    }
    return this.findLibrary(serverId, key);
  }
}
