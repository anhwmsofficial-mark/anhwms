import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: true,
    area: 'import-staging',
    timestamp: new Date().toISOString(),
  });
}
