import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import * as selfsigned from 'selfsigned';

export interface TlsMaterial {
  cert: Buffer;
  key: Buffer;
}

const CERT_FILE = 'cert.pem';
const KEY_FILE = 'key.pem';
/** ~10 years, so users don't get surprise expiries on a homelab box. */
const CERT_VALIDITY_DAYS = 3650;

/**
 * Ensure a TLS keypair exists under `${dataDir}/tls/`. If missing, generate a
 * FRESH self-signed cert with the pure-JS `selfsigned` package (multi-arch
 * clean) and write it. We never reuse any external/Gaps key. The key material
 * is written to disk under the gitignored data dir and is NEVER logged.
 *
 * Returns the cert + key buffers ready for Nest's `httpsOptions`.
 */
export async function ensureTlsMaterial(dataDir: string): Promise<TlsMaterial> {
  const logger = new Logger('Tls');
  const tlsDir = join(dataDir, 'tls');
  const certPath = join(tlsDir, CERT_FILE);
  const keyPath = join(tlsDir, KEY_FILE);

  if (existsSync(certPath) && existsSync(keyPath)) {
    logger.log(`Using existing TLS cert at ${certPath}`);
    return { cert: readFileSync(certPath), key: readFileSync(keyPath) };
  }

  mkdirSync(tlsDir, { recursive: true });

  const notBeforeDate = new Date();
  const notAfterDate = new Date(
    notBeforeDate.getTime() + CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  );

  const attrs = [{ name: 'commonName', value: 'voids.local' }];
  const pems = await selfsigned.generate(attrs, {
    notBeforeDate,
    notAfterDate,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' }, // DNS
          { type: 7, ip: '127.0.0.1' }, // IP
        ],
      },
    ],
  });

  writeFileSync(certPath, pems.cert, { mode: 0o600 });
  writeFileSync(keyPath, pems.private, { mode: 0o600 });
  // Log the path only — never the key material.
  logger.log(`Generated fresh self-signed TLS cert at ${certPath}`);

  return { cert: Buffer.from(pems.cert), key: Buffer.from(pems.private) };
}
