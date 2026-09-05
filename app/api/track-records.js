import { NextResponse } from 'next/server';
import trackRecordService from '../lib/track-record-service.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const records = trackRecordService.getAllRecords();
    return NextResponse.json({
      success: true,
      records,
      total: records.length
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch track records',
      message: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.symbol || !body.type || !body.score) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: symbol, type, score'
      }, 400);
    }
    
    const record = trackRecordService.recordOpportunity({
      symbol: body.symbol,
      type: body.type,
      score: body.score,
      entryPrice: body.entryPrice,
      stopPrice: body.stopPrice,
      targetPrice: body.targetPrice,
      direction: body.direction,
      expectedTimeframe: body.expectedTimeframe,
      outcome: body.outcome || 'OPEN', // Default to OPEN if not specified
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({
      success: true,
      record,
      message: 'Opportunity recorded successfully'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to record opportunity',
      message: error.message
    }, 500);
  }
}