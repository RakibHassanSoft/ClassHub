'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { errorMessage, post } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/misc';

/** Opened by scanning the teacher's QR code: checks the student in automatically. */
function CheckinFromQr() {
  const { classId, sessionId } = useParams<{ classId: string; sessionId: string }>();
  const code = useSearchParams().get('code') ?? '';
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error'; message: string }>({ status: 'loading', message: '' });
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    post(`/classes/${classId}/attendance/${sessionId}/checkin`, { code })
      .then((res) => setState({ status: 'ok', message: res.message }))
      .catch((err) => setState({ status: 'error', message: errorMessage(err) }));
  }, [classId, sessionId, code]);

  if (state.status === 'loading') return <PageLoader label="Checking you in…" />;

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card className="p-8 text-center">
        {state.status === 'ok' ? (
          <CheckCircle2 className="mx-auto size-16 text-emerald-500" />
        ) : (
          <XCircle className="mx-auto size-16 text-rose-500" />
        )}
        <h1 className="mt-4 text-xl font-extrabold">{state.status === 'ok' ? 'Checked in' : 'Could not check in'}</h1>
        <p className="mt-2 text-sm text-slate-600">{state.message}</p>
        {state.status === 'error' && (
          <p className="mt-1 text-xs text-slate-500">
            QR codes change every 30 seconds — open the class and type the current code instead.
          </p>
        )}
        <Link href={`/classes/${classId}`}>
          <Button className="mt-6">Open class</Button>
        </Link>
      </Card>
    </div>
  );
}

export default function CheckinPage() {
  return (
    <Suspense>
      <CheckinFromQr />
    </Suspense>
  );
}
