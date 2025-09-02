import { cookies } from 'next/headers';

const EMBED_COOKIE = 'embed2_ok';

export async function hasEmbedCookie() {
  const c = await cookies();
  return c.get(EMBED_COOKIE)?.value === '1';
}

export async function requireEmbedAllowed() {
  if (process.env.REQUIRE_EMBED !== '1') return true; // Feature ausgeschaltet
  return hasEmbedCookie();
}

export const EMBED_COOKIE_NAME = EMBED_COOKIE;