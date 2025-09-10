import { cookies } from 'next/headers';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const cookieStore = await cookies();
  const version = process.env.SITE_AUTH_VERSION || '1';
  const authed = cookieStore.get('site_auth')?.value === '1' || cookieStore.get('site_auth')?.value === version;
  return <HomeClient serverAuthed={authed} />;
}
