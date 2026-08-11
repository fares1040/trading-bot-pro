import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key);
}

function validTicker(value) {
  return /^[A-Z][A-Z0-9.^=-]{0,11}$/.test(
    String(value || '').trim().toUpperCase()
  );
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

/* =========================================================
   GET — جلب سجل الصفقات
========================================================= */

export async function GET() {
  try {
    const supabase = getSupabase();

    if (!supabase) {
      return NextResponse.json(
        {
          success: false,
          error: 'Supabase is not configured',
        },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from('trade_journal')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      console.error(
        'Journal GET error:',
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        count: data?.length || 0,
        data: data || [],
      },
      {
        headers: {
          'Cache-Control':
            'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error(
      'Journal GET route error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          'تعذر تحميل سجل الصفقات حالياً',
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST — إضافة صفقة
========================================================= */

export async function POST(request) {
  try {
    const supabase = getSupabase();

    if (!supabase) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Supabase is not configured',
        },
        { status: 500 }
      );
    }

    const body =
      await request
        .json()
        .catch(() => ({}));

    const ticker = String(
      body?.ticker || ''
    )
      .trim()
      .toUpperCase();

    const price =
      numberOrNull(body?.price);

    const targetPrice =
      numberOrNull(
        body?.target_price
      );

    const stopLoss =
      numberOrNull(
        body?.stop_loss
      );

    const confidence =
      numberOrNull(
        body?.confidence
      );

    const optionIdea =
      typeof body?.option_idea ===
      'string'
        ? body.option_idea
            .trim()
            .slice(0, 500)
        : null;

    if (!validTicker(ticker)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'رمز السهم غير صالح',
        },
        { status: 400 }
      );
    }

    if (
      price == null ||
      price <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'سعر الدخول غير صالح',
        },
        { status: 400 }
      );
    }

    if (
      targetPrice == null ||
      targetPrice <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'الهدف غير صالح',
        },
        { status: 400 }
      );
    }

    if (
      stopLoss == null ||
      stopLoss <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'وقف الخسارة غير صالح',
        },
        { status: 400 }
      );
    }

    if (stopLoss >= price) {
      return NextResponse.json(
        {
          success: false,
          error:
            'وقف الخسارة يجب أن يكون أقل من سعر الدخول',
        },
        { status: 400 }
      );
    }

    const riskPercent =
      ((price - stopLoss) /
        price) *
      100;

    const rewardPercent =
      ((targetPrice - price) /
        price) *
      100;

    const riskReward =
      price - stopLoss > 0
        ? (targetPrice - price) /
          (price - stopLoss)
        : null;

    const payload = {
      ticker,

      price: Number(
        price.toFixed(4)
      ),

      target_price: Number(
        targetPrice.toFixed(4)
      ),

      stop_loss: Number(
        stopLoss.toFixed(4)
      ),

      confidence:
        confidence == null
          ? null
          : Math.round(
              clamp(
                confidence
              )
            ),

      option_idea:
        optionIdea,

      created_at:
        new Date().toISOString(),
    };

    const {
      data,
      error,
    } = await supabase
      .from('trade_journal')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error(
        'Journal INSERT error:',
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          'تم حفظ الصفقة في السجل',
        data,
        analytics: {
          riskPercent:
            Number(
              riskPercent.toFixed(
                2
              )
            ),

          rewardPercent:
            Number(
              rewardPercent.toFixed(
                2
              )
            ),

          riskReward:
            riskReward == null
              ? null
              : Number(
                  riskReward.toFixed(
                    2
                  )
                ),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      'Journal POST route error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          'تعذر حفظ الصفقة حالياً',
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE — حذف صفقة من السجل
========================================================= */

export async function DELETE(request) {
  try {
    const supabase = getSupabase();

    if (!supabase) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Supabase is not configured',
        },
        { status: 500 }
      );
    }

    const body =
      await request
        .json()
        .catch(() => ({}));

    const id =
      body?.id ??
      new URL(request.url)
        .searchParams
        .get('id');

    if (
      id == null ||
      String(id).trim() === ''
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'معرف الصفقة غير موجود',
        },
        { status: 400 }
      );
    }

    const {
      error,
    } = await supabase
      .from('trade_journal')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(
        'Journal DELETE error:',
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        'تم حذف الصفقة',
    });
  } catch (error) {
    console.error(
      'Journal DELETE route error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          'تعذر حذف الصفقة حالياً',
      },
      { status: 500 }
    );
  }
}