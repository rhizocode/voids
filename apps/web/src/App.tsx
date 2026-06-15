import { useQuery } from '@tanstack/react-query';
import { version as sharedVersion } from '@voids/shared';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-700 py-2">
      <span className="text-slate-400">{label}</span>
      <span className={ok ? 'text-emerald-400' : 'text-slate-200'}>{value}</span>
    </div>
  );
}

export function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => fetchJson<{ status: string }>('/api/health'),
  });
  const apiVersion = useQuery({
    queryKey: ['version'],
    queryFn: () => fetchJson<{ version: string }>('/api/version'),
  });

  return (
    <main className="mx-auto max-w-xl p-8 font-sans text-slate-200">
      <h1 className="mb-1 text-3xl font-bold">Voids</h1>
      <p className="mb-6 text-slate-400">Phase 0 skeleton — wiring check.</p>

      <section className="rounded-lg bg-slate-800 p-6">
        <Row
          label="GET /api/health"
          ok={health.data?.status === 'ok'}
          value={
            health.isLoading
              ? 'loading…'
              : health.isError
                ? 'error'
                : (health.data?.status ?? 'unknown')
          }
        />
        <Row
          label="GET /api/version"
          value={
            apiVersion.isLoading
              ? 'loading…'
              : apiVersion.isError
                ? 'error'
                : (apiVersion.data?.version ?? 'unknown')
          }
        />
        <Row label="@voids/shared version" value={sharedVersion} />
      </section>
    </main>
  );
}
