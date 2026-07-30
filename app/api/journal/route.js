// app/api/journal/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// 📥 جلب الصفقات المحفوظة مسبقاً في السجل
export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase is not configured' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('trade_journal')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 💾 حفظ صفقة جديدة في السجل
export async function POST(request) {
  try {
    const body = await request.json();

    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase is not configured' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('trade_journal')
      .insert([{
        ticker: body.ticker,
        price: body.price,
        target_price: body.target_price,
        stop_loss: body.stop_loss,
        confidence: body.confidence,
        option_idea: body.option_idea,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
