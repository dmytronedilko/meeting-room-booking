'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Status = 'loading' | 'success' | 'error';

function ConfirmEmail() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const token = searchParams.get('token');
  const [status, setStatus] = React.useState<Status>('loading');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This confirmation link is missing its token.');
      return;
    }
    let active = true;
    api
      .confirmEmail(token)
      .then(() => {
        if (!active) return;
        setStatus('success');
        // If a session is open, drop the banner on the next app view.
        void queryClient.invalidateQueries({ queryKey: ['me'] });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus('error');
        setMessage(
          error instanceof ApiError
            ? error.message
            : 'Could not confirm your email, please try again.',
        );
      });
    return () => {
      active = false;
    };
  }, [token, queryClient]);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          {status === 'loading' ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Confirming your email…
            </>
          ) : status === 'success' ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-primary" /> Email confirmed
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-destructive" /> Confirmation failed
            </>
          )}
        </CardTitle>
        <CardDescription>
          {status === 'success'
            ? 'Thanks! Your email is verified — you can now book meeting rooms.'
            : status === 'error'
              ? message
              : 'Hang tight while we verify your link.'}
        </CardDescription>
      </CardHeader>
      {status !== 'loading' ? (
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/">Go to the app</Link>
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}

export default function ConfirmEmailPage() {
  // useSearchParams needs a Suspense boundary during static rendering.
  return (
    <React.Suspense fallback={null}>
      <ConfirmEmail />
    </React.Suspense>
  );
}
