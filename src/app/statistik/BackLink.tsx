"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BackLink() {
  const router = useRouter();
  return (
    <div className="mb-3 flex items-center gap-3">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-blue-600 hover:underline"
      >
        ← Zurück
      </button>
      <span className="text-gray-400">|</span>
      <Link href="/" className="text-gray-600 hover:underline">Start</Link>
    </div>
  );
}
