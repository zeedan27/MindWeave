import { NextRequest, NextResponse } from 'next/server';
import { isLiveAIConfigured, resolveRuntimeAIConfig } from '@/lib/ai/gateway';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ probe: string }> }
) {
  const { probe } = await context.params;

  if (probe === 'live') {
    return NextResponse.json(
      {
        ok: true,
        status: 'live',
        uptimeSec: Math.round(process.uptime()),
      },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  if (probe === 'ready') {
    const config = resolveRuntimeAIConfig(request.headers);
    return NextResponse.json(
      {
        ok: true,
        status: 'ready',
        aiServerConfigured: isLiveAIConfigured(config),
        provider: isLiveAIConfigured(config) ? config.provider : null,
        demoAvailable: true,
      },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  return NextResponse.json({ ok: false, error: 'Unknown probe' }, { status: 404 });
}
