import { NextResponse } from 'next/server';

export async function POST(req: Request) {
	try {
		// Platzhalter-Login-Endpunkt: akzeptiert JSON, liefert 200 mit Echo
		const body = await req.json().catch(() => ({}));
		return NextResponse.json({ ok: true, body }, { status: 200 });
	} catch (e) {
		return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
	}
}

export async function GET() {
	// Optional: Healthcheck
	return NextResponse.json({ ok: true }, { status: 200 });
}
