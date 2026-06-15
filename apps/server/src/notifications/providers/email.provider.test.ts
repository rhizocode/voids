import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationProviderId, type EmailConfig } from '@voids/shared';

const { sendMail, close, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  const close = vi.fn();
  const createTransport = vi.fn(() => ({ sendMail, close }));
  return { sendMail, close, createTransport };
});

vi.mock('nodemailer', () => ({ createTransport }));

import { EmailProvider } from './email.provider';

const baseConfig: EmailConfig = {
  id: NotificationProviderId.EMAIL,
  username: 'user',
  password: 'pass',
  mailTo: 'to@example.com',
  mailFrom: 'from@example.com',
  mailServer: 'smtp.example.com',
  mailPort: 587,
  mailSmtpAuth: true,
  mailSmtpTlsEnabled: true,
};

describe('EmailProvider (nodemailer mocked)', () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
    close.mockReset();
    createTransport.mockClear();
  });

  it('builds an SMTP transport from config and sends subject/text', async () => {
    const p = new EmailProvider();
    await p.send(baseConfig, 'TEST', 'info', 'Title', 'Body');

    const transportOpts = createTransport.mock.calls[0][0] as Record<string, unknown>;
    expect(transportOpts.host).toBe('smtp.example.com');
    expect(transportOpts.port).toBe(587);
    expect(transportOpts.secure).toBe(false);
    expect(transportOpts.requireTLS).toBe(true);
    expect(transportOpts.auth).toEqual({ user: 'user', pass: 'pass' });

    const mail = sendMail.mock.calls[0][0] as Record<string, unknown>;
    expect(mail).toEqual({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Title',
      text: 'Body',
    });
    expect(close).toHaveBeenCalled();
  });

  it('uses implicit TLS (secure) on port 465', async () => {
    const p = new EmailProvider();
    await p.send({ ...baseConfig, mailPort: 465 }, 'TEST', 'info', 'T', 'B');
    const transportOpts = createTransport.mock.calls[0][0] as Record<string, unknown>;
    expect(transportOpts.secure).toBe(true);
  });

  it('omits auth when mailSmtpAuth is false', async () => {
    const p = new EmailProvider();
    await p.send({ ...baseConfig, mailSmtpAuth: false }, 'TEST', 'info', 'T', 'B');
    const transportOpts = createTransport.mock.calls[0][0] as Record<string, unknown>;
    expect(transportOpts.auth).toBeUndefined();
  });

  it('throws and still closes the transport on send failure', async () => {
    sendMail.mockRejectedValueOnce(new Error('smtp down'));
    const p = new EmailProvider();
    await expect(p.send(baseConfig, 'TEST', 'info', 'T', 'B')).rejects.toThrow(/smtp down/);
    expect(close).toHaveBeenCalled();
  });
});
