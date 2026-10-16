import { NextRequest, NextResponse } from 'next/server';
import { IndexerError } from '@/lib/indexer/errors';
import { loadIndexerResource } from '@/lib/indexer/server';
import type { IndexerErrorEnvelope } from '@/lib/indexer/types';

/**
 * The single browser-facing boundary to the indexer. Only allow-listed
 * resources are forwarded; credentials stay on the server and failures are
 * reported as a typed `IndexerErrorEnvelope` without upstream details.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;

  try {
    const envelope = await loadIndexerResource(path, req.nextUrl.searchParams, {
      signal: req.signal,
    });
    return NextResponse.json(envelope, { headers: NO_STORE });
  } catch (err) {
    const error = err instanceof IndexerError ? err : new IndexerError('upstream');
    if (!(err instanceof IndexerError)) {
      console.error('[indexer] unexpected proxy failure:', (err as Error)?.name ?? 'Error');
    }
    const body: IndexerErrorEnvelope = {
      ok: false,
      error: { code: error.code, message: error.message },
    };
    return NextResponse.json(body, { status: error.status, headers: NO_STORE });
  }
}
