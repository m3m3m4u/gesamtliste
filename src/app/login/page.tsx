import React from 'react';
import LoginClient from '@/app/login/LoginClient';
import { cookies } from 'next/headers';
// Redirect aktuell deaktiviert, weil Auth global aus ist
// import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams?: SP }) {
  const sp = searchParams ? await searchParams : undefined;
  const rawNext = sp?.next;
  const next = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  // Auth momentan deaktiviert – Cookies nur auskommentiert um Lint zu vermeiden
  // const cookieStore = await cookies();
  // const version = process.env.SITE_AUTH_VERSION || '1';
  // Hinweis: Auth derzeit deaktiviert; Variable nicht genutzt -> entfernt um Lint-Warnung zu vermeiden
  // const authed = cookieStore.get('site_auth')?.value === version;
  // Auth deaktiviert -> kein Redirect bei vorhandenem Cookie
  return <LoginClient nextPath={typeof next === 'string' && next ? next : '/'} />;
}
