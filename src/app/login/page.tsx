import React from 'react';
import LoginClient from '@/app/login/LoginClient';

export const dynamic = 'force-dynamic';

export default function LoginPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const next = typeof searchParams?.next === 'string' ? searchParams!.next : '/';
  return <LoginClient nextPath={next || '/'} />;
}
