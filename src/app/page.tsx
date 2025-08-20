import React from 'react';
import LoginClient from '@/app/login/LoginClient';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = searchParams ? await searchParams : undefined;
  const rawNext = sp?.next;
  const next = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  return <LoginClient nextPath={typeof next === 'string' && next ? next : '/schueler'} />;
}
