import React from 'react';
import FrageClient from './FrageClient';

export const dynamic = 'force-dynamic';

type SP = Promise<Record<string,string|string[]|undefined>>;

export default async function FragePage({ searchParams }: { searchParams?: SP }) {
  const sp = searchParams ? await searchParams : undefined;
  const rawNext = sp?.next;
  const next = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  const safeNext = (next && next.startsWith('/')) ? next : '/';
  return <FrageClient nextPath={safeNext} />;
}
