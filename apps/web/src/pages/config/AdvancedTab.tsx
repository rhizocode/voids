import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthMode, useNuke } from '../../api/hooks';
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  Label,
  Spinner,
  useToast,
} from '../../components/ui';
import { ApiError } from '../../api/client';

const CONFIRM_WORD = 'NUKE';

function authModeLabel(mode: string | undefined): string {
  if (mode === 'basic') return 'Basic auth enabled';
  if (mode === 'none') return 'None (trusted LAN)';
  return 'unknown';
}

export function AdvancedTab() {
  const authMode = useAuthMode();
  const nuke = useNuke();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [confirm, setConfirm] = useState('');
  const canNuke = confirm === CONFIRM_WORD && !nuke.isPending;

  async function onNuke() {
    if (!canNuke) return;
    try {
      const result = await nuke.mutateAsync();
      toast(result.reason, 'success');
      setConfirm('');
      navigate('/');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Nuke failed. Manually delete files.', 'error');
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardTitle>Application info</CardTitle>
        <CardDescription>Diagnostics for this Voids instance.</CardDescription>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">Version</dt>
            <dd className="font-mono text-slate-200">{__APP_VERSION__}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">Authentication</dt>
            <dd className="text-slate-200">
              {authMode.isLoading ? 'loading…' : authModeLabel(authMode.data?.mode)}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-slate-500">
          Authentication and TLS are configured via environment variables at deploy time — see the
          project README. Basic auth uses the browser&apos;s native HTTP prompt; there is no login
          page.
        </p>
      </Card>

      <Card className="border-red-800/60 bg-red-950/20">
        <CardTitle className="text-red-300">Danger zone</CardTitle>
        <CardDescription className="text-red-300/80">
          Wiping data is permanent and cannot be undone.
        </CardDescription>

        <div className="mt-5 space-y-4">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-red-300">Wipe all data</span> removes every
            configured media server, library, and Radarr connection; all owned and recommended
            movies; cached TMDB and scan data; and every notification configuration. Settings are
            reset to defaults and the default providers are reseeded. This affects the entire
            instance.
          </p>

          <div>
            <Label htmlFor="nuke-confirm">
              Type <span className="font-mono text-red-300">{CONFIRM_WORD}</span> to confirm
            </Label>
            <Input
              id="nuke-confirm"
              className="mt-1"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={CONFIRM_WORD}
            />
          </div>

          <Button variant="danger" disabled={!canNuke} onClick={onNuke}>
            {nuke.isPending && <Spinner />}
            Wipe all data
          </Button>
        </div>
      </Card>
    </div>
  );
}
