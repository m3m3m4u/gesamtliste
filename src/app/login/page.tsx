import React from 'react';
import LoginClient from '@/app/login/LoginClient';

export const dynamic = 'force-dynamic';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams?: SP }) {
  const sp = searchParams ? await searchParams : undefined;
  const rawNext = sp?.next;
  const next = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  return <LoginClient nextPath={typeof next === 'string' && next ? next : '/'} />;
}
