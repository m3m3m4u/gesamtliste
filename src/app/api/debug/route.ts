import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const info: Record<string, unknown> = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    repo: process.env.VERCEL_GIT_REPO_SLUG || null,
    buildTime: process.env.VERCEL_DEPLOYMENT_ID || null,
    node: process.version,
    hasMongoUri: !!process.env.MONGODB_URI,
  };
  try {
    const client = await clientPromise;
    const db = client.db();
    const col = db.collection('students');
    const count = await col.estimatedDocumentCount();
    info.db = db.databaseName;
    info.studentsCount = count;
  } catch (e) {
    info.dbError = e instanceof Error ? e.message : e;
  }
  return NextResponse.json(info);
}
