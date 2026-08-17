import { NextResponse } from 'next/server';
import { HIC_THRESHOLDS } from '@/lib/hunter-intelligence';
import { getInstitutionalProviderStatus } from '@/lib/institutional-provider';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)
  );

  const checks = {
    yahoo: true,
    finnhubConfigured: Boolean(process.env.FINNHUB_API_KEY || process.env.FINNHUB_TOKEN),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    supabaseConfigured,
    supabaseAuthConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    discordConfigured: Boolean(process.env.DISCORD_WEBHOOK_URL),
    alertsDedupeConfigured: supabaseConfigured,
  };

  const institutional = getInstitutionalProviderStatus();

  const missingOptional = [
    !checks.finnhubConfigured && 'FINNHUB_API_KEY',
    !checks.geminiConfigured && 'GEMINI_API_KEY',
    !checks.openaiConfigured && 'OPENAI_API_KEY',
    !checks.supabaseConfigured && 'SUPABASE_SERVICE_ROLE_KEY',
    !checks.telegramConfigured && 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID',
    !checks.discordConfigured && 'DISCORD_WEBHOOK_URL',
    !institutional.configured && 'FINRA_API_CLIENT_ID / FINRA_API_CLIENT_SECRET',
  ].filter(Boolean);

  return NextResponse.json({
    success: true,
    status: missingOptional.length === 0 ? 'ready' : 'operational-with-optional-services',
    timestamp: new Date().toISOString(),
    checks,
    phases: {
      productionValidation: { status: 'active', checks, optionalMissing: missingOptional },
      hicCandidateGate: { status: 'active', thresholds: HIC_THRESHOLDS },
      marketDataThroughput: { status: 'active', strategy: 'bounded concurrency + request timeouts + provider fallback' },
      discovery: { status: 'active', source: 'HUNTER_UNIVERSE with Yahoo Trending fallback' },
      institutionalIntelligence: {
        provider: institutional.provider,
        available: institutional.available,
        status: institutional.configured
          ? (institutional.available ? 'connected' : 'configured-awaiting-verification')
          : 'provider-not-configured',
        reason: institutional.reason,
        capabilities: institutional.capabilities || {
          atsActivity: false,
          otcActivity: false,
          darkPoolRealtime: false,
          optionsFlow: false,
          whaleFlow: false,
          openInterest: false,
        },
        note: institutional.configured
          ? 'FINRA ATS/OTC weekly summary data. Delayed/aggregated institutional activity proxy.'
          : 'FINRA credentials not configured. No institutional data is fabricated.',
      },
      hunterScore: { status: 'active', formula: 'Setup 55% + Conviction 35% + Market Regime 10%' },
      alerts: { status: 'active', dedupe: checks.alertsDedupeConfigured },
      uiPremiumAdmin: { status: 'feature-gated', auth: checks.supabaseAuthConfigured ? 'available' : 'not-configured' },
    },
    policy: {
      noMockMarketData: true,
      scoringUnchanged: true,
      optionsScannerAvailable: true,
      optionsDataDependsOnYahooChain: true,
      darkPoolAvailable: false,
      institutionalFlowAvailable: false,
      aiDoesNotOverrideTechnicalScore: true,
    },
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
