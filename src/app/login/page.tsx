import React from 'react';
import LoginClient from '@/app/login/LoginClient';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams?: SP }) {
  const sp = searchParams ? await searchParams : undefined;
  const rawNext = sp?.next;
  const next = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  const cookieStore = await cookies();
  const version = process.env.SITE_AUTH_VERSION || '1';
  const authed = cookieStore.get('site_auth')?.value === version;
  if (authed) redirect('/');
  return <LoginClient nextPath={typeof next === 'string' && next ? next : '/'} />;
}
