import React from 'react';
import { cookies } from 'next/headers';
import { hasEmbedCookie } from '@/lib/embedGuard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const cookieStore = await cookies();
  const version = process.env.SITE_AUTH_VERSION || '1';
  const authed = cookieStore.get('site_auth')?.value === version;
  const requireEmbed = process.env.REQUIRE_EMBED === '1';
  const embedded = await hasEmbedCookie();
  // Übersicht ist immer öffentlich sichtbar
  return (
    <main className="w-full flex justify-center p-8">
      <div className="text-center space-y-8 max-w-md mt-8">
        <h1 className="text-3xl font-bold tracking-tight">Übersicht</h1>
        <p className="text-gray-600 leading-relaxed">Wähle einen Bereich.</p>
        {requireEmbed && !embedded && (
          <div className="p-4 rounded border bg-yellow-50 text-sm text-left">
            <p className="font-medium mb-1">Eingebettete Nutzung erforderlich</p>
            <p className="text-gray-700">Diese Anwendung ist nur eingebettet nutzbar. (Cookie noch nicht gesetzt)</p>
          </div>
        )}
        <div className="flex flex-col gap-4">
          <a href="/schueler" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md shadow transition-colors">Suchen & Bearbeiten</a>
          <a href="/klassenliste" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-md shadow transition-colors">Klassenliste</a>
          <a href="/angebote" className="inline-block bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-md shadow transition-colors">Angebote</a>
          <a href="/schwerpunkte" className="inline-block bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-md shadow transition-colors">Schwerpunkte</a>
          <a href="/statistik" className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-3 rounded-md shadow transition-colors">Statistik</a>
          <a href="/listen" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-md shadow transition-colors">Listen (Filter)</a>
          <a href="/optionen" className="inline-block bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-8 py-3 rounded-md shadow transition-colors">Optionen</a>
          {authed && (
            <form action="/api/logout" method="post">
              <button type="submit" className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-8 py-3 rounded-md shadow transition-colors">Abmelden</button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
