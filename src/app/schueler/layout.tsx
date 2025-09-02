import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function SchuelerLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const cv = c.get('site_auth')?.value;
  const expected = process.env.SITE_AUTH_VERSION || '1';
  if (cv !== expected) {
    redirect('/login?next=' + encodeURIComponent('/schueler'));
  }
  return <>{children}</>;
}
