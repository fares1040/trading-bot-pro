import { NextResponse } from 'next/server';
import { getDefaultPlan, getPlanFeatures } from '@/lib/access-control';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const plan = getDefaultPlan();
  const authAvailable = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return NextResponse.json({
    success: true,
    authenticated: false,
    authAvailable,
    ...getPlanFeatures(plan),
    note: authAvailable
      ? 'Supabase Auth configuration is available; user-specific sign-in/roles remain environment-dependent.'
      : 'Feature gating is active using the configured default plan. Add Supabase Auth variables for user-specific access control.',
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
