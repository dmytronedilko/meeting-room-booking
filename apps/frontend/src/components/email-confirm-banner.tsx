'use client';

import { Loader2, MailWarning } from 'lucide-react';

import { useMe, useResendConfirmation } from '@/lib/hooks';
import { Button } from '@/components/ui/button';

/**
 * Shown to signed-in users who have not confirmed their email yet: booking is
 * blocked server-side until they do. The confirmation link is written to the
 * server log (dev mode, no SMTP); "Resend link" re-logs a fresh one.
 */
export function EmailConfirmBanner() {
  const { data: user } = useMe();
  const resend = useResendConfirmation();

  if (!user || user.emailConfirmed) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-2">
        <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Confirm your email to start booking rooms. In dev mode the confirmation link is written to
          the server log.
        </span>
      </span>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-400/60 bg-transparent hover:bg-amber-100 dark:hover:bg-amber-900/40"
        disabled={resend.isPending}
        onClick={() => resend.mutate()}
      >
        {resend.isPending ? <Loader2 className="animate-spin" /> : null}
        Resend link
      </Button>
    </div>
  );
}
