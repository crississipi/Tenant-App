import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing url parameter', { status: 400 });
    }

    // Basic safety: only allow HTTP(S) URLs
    if (!/^https?:\/\//i.test(targetUrl)) {
      return new Response('Invalid url parameter', { status: 400 });
    }

    const upstreamRes = await fetch(targetUrl);

    if (!upstreamRes.ok) {
      return new Response('Failed to fetch document', { status: upstreamRes.status });
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/pdf';
    const arrayBuffer = await upstreamRes.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Force inline display instead of attachment
        'Content-Disposition': 'inline',
        // Small cache to avoid re-fetching too often
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('Error proxying document:', error);
    return new Response('Error fetching document', { status: 500 });
  }
}
