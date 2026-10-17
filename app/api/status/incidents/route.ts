import { NextResponse } from 'next/server';
import { getIncidentHistory } from '@/lib/instatus';

// #935 — server proxy for the public Instatus summary, so the client bundle
// never needs NEXT_PUBLIC_INSTATUS_SUBDOMAIN branching/caching logic and a
// future switch to the authenticated admin API stays a one-file change.
export async function GET() {
  try {
    const incidents = await getIncidentHistory(20);
    return NextResponse.json({ incidents });
  } catch (error) {
    console.error('Error fetching incident history:', error);
    return NextResponse.json({ error: 'Failed to load incident history' }, { status: 502 });
  }
}
