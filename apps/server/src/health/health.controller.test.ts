import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DB } from '../db/db.module';
import type { DbHandle } from '../db/client';

function makeHandle(runFn: () => void = () => undefined): DbHandle {
  return {
    sqlite: { prepare: () => ({ run: runFn }) } as unknown as DbHandle['sqlite'],
    db: {} as DbHandle['db'],
  };
}

async function buildController(handle: DbHandle): Promise<HealthController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: DB, useValue: handle }],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    controller = await buildController(makeHandle());
  });

  it('reports ok when db probe succeeds', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('throws ServiceUnavailableException when db probe fails', async () => {
    const ctrl = await buildController(makeHandle(() => { throw new Error('db gone'); }));
    expect(() => ctrl.health()).toThrow(ServiceUnavailableException);
  });

  it('reports a version string', () => {
    expect(typeof controller.version().version).toBe('string');
  });
});
