import { NextResponse } from 'next/server';

export async function POST() {
	// Platzhalter-Logout: nichts zu tun, aber konforme Antwort
	return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET() {
	return NextResponse.json({ ok: true }, { status: 200 });
}
