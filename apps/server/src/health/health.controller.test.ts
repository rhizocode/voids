import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('reports ok', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('reports a version string', () => {
    expect(typeof controller.version().version).toBe('string');
  });
});
