import Link from 'next/link';

export default function LoginPage() {
	return (
		<div className="p-6 max-w-md mx-auto space-y-4">
			<h1 className="text-xl font-semibold">Login</h1>
			<p className="text-sm text-gray-600">Diese Seite ist ein Platzhalter. Die Authentifizierung ist aktuell nicht aktiv.</p>
			<Link href="/" className="text-sm text-blue-600 underline">Zurück</Link>
		</div>
	);
}
