import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  const client = await clientPromise;
  const db = client.db();
  const items = await db.collection('items').find({}).toArray();
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const client = await clientPromise;
  const db = client.db();
  const data = await request.json();
  const result = await db.collection('items').insertOne(data);
  return NextResponse.json(result);
}
