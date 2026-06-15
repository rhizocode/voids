import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  NotificationProviderId,
  NOTIFICATION_PROVIDER_NAMES,
  NotificationType,
  Payload,
  allNotificationTypes,
  discordConfigSchema,
  emailConfigSchema,
  gotifyConfigSchema,
  pushBulletConfigSchema,
  pushOverConfigSchema,
  slackConfigSchema,
  telegramConfigSchema,
  type NotificationConfig,
  type NotificationProviderConfig,
  type NotificationProviderId as ProviderId,
  type NotificationType as NotificationTypeValue,
  type UpdateNotificationRequest,
} from '@voids/shared';
import type { z } from 'zod';
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Spinner,
  Switch,
  useToast,
} from '../../components/ui';
import { useTestNotification, useUpdateNotification } from '../../api/hooks';
import { ApiError } from '../../api/client';

/** A renderable field within a provider's config form. */
interface FieldSpec {
  /** Key on the provider's config object. */
  name: string;
  label: string;
  /** Secrets render as password inputs; numbers as number inputs. */
  type: 'text' | 'password' | 'number' | 'switch';
  placeholder?: string;
}

/**
 * Field layout per provider id. The names mirror the shared per-provider
 * config schemas exactly (see `@voids/shared` notifications domain) so the
 * form values feed straight into the schema for validation. We do not
 * redefine the validation here — that comes from the shared schema below.
 */
const PROVIDER_FIELDS: Record<ProviderId, FieldSpec[]> = {
  [NotificationProviderId.TELEGRAM]: [
    { name: 'botId', label: 'Bot token', type: 'password', placeholder: 'Telegram bot token' },
    { name: 'chatId', label: 'Chat ID', type: 'text', placeholder: 'Chat ID' },
  ],
  [NotificationProviderId.PUSHBULLET]: [
    {
      name: 'accessToken',
      label: 'Access token',
      type: 'password',
      placeholder: 'PushBullet access token',
    },
    { name: 'channelTag', label: 'Channel tag (optional)', type: 'text' },
  ],
  [NotificationProviderId.SLACK]: [
    {
      name: 'webHookUrl',
      label: 'Webhook URL',
      type: 'text',
      placeholder: 'https://hooks.slack.com/services/...',
    },
  ],
  [NotificationProviderId.GOTIFY]: [
    {
      name: 'address',
      label: 'Server URL',
      type: 'text',
      placeholder: 'https://gotify.example.com',
    },
    { name: 'token', label: 'App token', type: 'password', placeholder: 'Gotify app token' },
    { name: 'priority', label: 'Priority', type: 'number' },
  ],
  [NotificationProviderId.EMAIL]: [
    { name: 'mailServer', label: 'SMTP host', type: 'text', placeholder: 'smtp.example.com' },
    { name: 'mailPort', label: 'SMTP port', type: 'number' },
    { name: 'username', label: 'Username', type: 'text' },
    { name: 'password', label: 'Password', type: 'password' },
    { name: 'mailFrom', label: 'From address', type: 'text', placeholder: 'voids@example.com' },
    { name: 'mailTo', label: 'To address', type: 'text', placeholder: 'you@example.com' },
    { name: 'mailSmtpAuth', label: 'Use SMTP authentication', type: 'switch' },
    { name: 'mailSmtpTlsEnabled', label: 'Use TLS', type: 'switch' },
  ],
  [NotificationProviderId.PUSHOVER]: [
    { name: 'user', label: 'User key', type: 'password', placeholder: 'PushOver user key' },
    { name: 'token', label: 'API token', type: 'password', placeholder: 'PushOver API token' },
    { name: 'priority', label: 'Priority', type: 'number' },
    { name: 'sound', label: 'Sound (optional)', type: 'text' },
    { name: 'retry', label: 'Retry (seconds)', type: 'number' },
    { name: 'expire', label: 'Expire (seconds)', type: 'number' },
  ],
  [NotificationProviderId.DISCORD]: [
    {
      name: 'webHookUrl',
      label: 'Webhook URL',
      type: 'text',
      placeholder: 'https://discord.com/api/webhooks/...',
    },
  ],
};

/** The shared per-provider config schema, keyed by id (used by zodResolver). */
const PROVIDER_SCHEMAS: Record<ProviderId, z.ZodTypeAny> = {
  [NotificationProviderId.TELEGRAM]: telegramConfigSchema,
  [NotificationProviderId.PUSHBULLET]: pushBulletConfigSchema,
  [NotificationProviderId.SLACK]: slackConfigSchema,
  [NotificationProviderId.GOTIFY]: gotifyConfigSchema,
  [NotificationProviderId.EMAIL]: emailConfigSchema,
  [NotificationProviderId.PUSHOVER]: pushOverConfigSchema,
  [NotificationProviderId.DISCORD]: discordConfigSchema,
};

/** Human-readable labels for each subscribable notification type. */
const TYPE_LABELS: Record<NotificationTypeValue, string> = {
  [NotificationType.TEST]: 'Test',
  [NotificationType.TMDB_API_CONNECTION]: 'TMDB API connection',
  [NotificationType.PLEX_SERVER_CONNECTION]: 'Media server connection',
  [NotificationType.PLEX_METADATA_UPDATE]: 'Metadata update',
  [NotificationType.PLEX_LIBRARY_UPDATE]: 'Library update',
  [NotificationType.GAPS_MISSING_COLLECTIONS]: 'Missing collections found',
};

/** Subscribable types shown as checkboxes — TEST is implicit, so excluded. */
const SUBSCRIBABLE_TYPES: NotificationTypeValue[] = allNotificationTypes.filter(
  (t) => t !== NotificationType.TEST,
);

interface PanelProps {
  provider: NotificationProviderConfig;
}

/**
 * One collapsible provider panel: enabled switch, provider-specific config
 * fields (validated against the shared schema), notification-type checkboxes,
 * Save and Test. Invalid config is caught client-side before the PUT.
 */
export function NotificationProviderPanel({ provider }: PanelProps) {
  const id = provider.id;
  const name = NOTIFICATION_PROVIDER_NAMES[id];
  const fields = PROVIDER_FIELDS[id];
  const schema = PROVIDER_SCHEMAS[id];

  const update = useUpdateNotification(id);
  const test = useTestNotification(id);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(provider.enabled);
  const [types, setTypes] = useState<NotificationTypeValue[]>(provider.notificationTypes);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NotificationConfig>({
    // The discriminated-union member for this provider validates its own shape.
    resolver: zodResolver(schema) as Resolver<NotificationConfig>,
    defaultValues: provider.config,
  });

  function toggleType(type: NotificationTypeValue, on: boolean) {
    setTypes((prev) => (on ? [...new Set([...prev, type])] : prev.filter((t) => t !== type)));
  }

  const onSave = handleSubmit(async (config) => {
    const body: UpdateNotificationRequest = {
      enabled,
      config: { ...config, id } as NotificationConfig,
      notificationTypes: types,
    };
    try {
      await update.mutateAsync(body);
      toast(`${name} settings saved.`, 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : `Failed to save ${name} settings.`, 'error');
    }
  });

  async function onTest() {
    try {
      const result = await test.mutateAsync();
      toast(
        result.reason,
        result.code === Payload.NOTIFICATION_TEST_SUCCEEDED.code ? 'success' : 'error',
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : `${name} test failed.`, 'error');
    }
  }

  const panelId = `notif-panel-${id}`;

  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-base font-semibold text-slate-100">{name}</span>
          <Badge tone={enabled ? 'success' : 'neutral'}>
            {enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </span>
        <span className="text-xs text-slate-400">{open ? 'Hide' : 'Edit'}</span>
      </button>

      {open && (
        <div id={panelId} className="mt-5 space-y-5">
          {/* Enabled */}
          <div className="flex items-center justify-between">
            <Label htmlFor={`${panelId}-enabled`}>Enabled</Label>
            <Switch
              id={`${panelId}-enabled`}
              aria-label={`Enable ${name}`}
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* Config fields */}
          <div className="space-y-4">
            {fields.map((field) => {
              const fieldId = `${panelId}-${field.name}`;
              const err = (errors as Record<string, { message?: string } | undefined>)[
                field.name
              ];
              if (field.type === 'switch') {
                const checked = Boolean(watch(field.name as keyof NotificationConfig));
                return (
                  <div key={field.name} className="flex items-center justify-between">
                    <Label htmlFor={fieldId}>{field.label}</Label>
                    <Switch
                      id={fieldId}
                      aria-label={field.label}
                      checked={checked}
                      onCheckedChange={(on) =>
                        setValue(field.name as keyof NotificationConfig, on as never, {
                          shouldValidate: true,
                        })
                      }
                    />
                  </div>
                );
              }
              return (
                <div key={field.name}>
                  <Label htmlFor={fieldId}>{field.label}</Label>
                  <Input
                    id={fieldId}
                    type={field.type}
                    autoComplete="off"
                    placeholder={field.placeholder}
                    {...register(
                      field.name as keyof NotificationConfig,
                      field.type === 'number' ? { valueAsNumber: true } : undefined,
                    )}
                  />
                  {err?.message && (
                    <p className="mt-1 text-xs text-red-400">{err.message}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Notification types */}
          <div>
            <Label>Notify on</Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUBSCRIBABLE_TYPES.map((type) => {
                const checkboxId = `${panelId}-type-${type}`;
                return (
                  <label
                    key={type}
                    htmlFor={checkboxId}
                    className="flex items-center gap-2 text-sm text-slate-300"
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-600"
                      checked={types.includes(type)}
                      onChange={(e) => toggleType(type, e.target.checked)}
                    />
                    {TYPE_LABELS[type]}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={onSave} disabled={update.isPending}>
              {update.isPending && <Spinner />}
              Save
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onTest}
              disabled={test.isPending}
            >
              {test.isPending && <Spinner />}
              Test
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
