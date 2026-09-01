const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', Accept: 'application/json' };

export const yahooHeaders = YAHOO_HEADERS;
export const SYMBOL_RE = /^[A-Z][A-Z0-9.^=-]{0,11}$/;

export function average(values) { const v = values.filter(Number.isFinite); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; }
export function clamp(v,min=0,max=100){ return Math.max(min,Math.min(max,Number.isFinite(v)?v:0)); }
export function rsi(closes, period=14){
  if(!Array.isArray(closes)||closes.length<=period)return null; let g=0,l=0;
  for(let i=1;i<=period;i++){const d=closes[i]-closes[i-1]; if(d>=0)g+=d;else l+=Math.abs(d);}
  let ag=g/period, al=l/period;
  for(let i=period+1;i<closes.length;i++){const d=closes[i]-closes[i-1];ag=((ag*(period-1))+(d>0?d:0))/period;al=((al*(period-1))+(d<0?Math.abs(d):0))/period;}
  return al===0?100:100-(100/(1+ag/al));
}
export function sma(values,period){return values.length>=period?average(values.slice(-period)):null;}
export function bollinger(closes,period=20){const mid=sma(closes,period);if(!mid)return {bandwidth:null,squeeze:false,score:0};const s=closes.slice(-period),sd=Math.sqrt(average(s.map(x=>(x-mid)**2))||0),bw=(4*sd/mid)*100;return {middle:mid,upper:mid+2*sd,lower:mid-2*sd,bandwidth:bw,squeeze:bw<9,score:bw<5?100:bw<7?90:bw<9?75:bw<12?50:20};}
export function analyzeQuote(meta,quote){
  const closes=(quote?.close||[]).map(Number).filter(Number.isFinite), highs=(quote?.high||[]).map(Number).filter(Number.isFinite), lows=(quote?.low||[]).map(Number).filter(Number.isFinite), vols=(quote?.volume||[]).map(Number).filter(Number.isFinite);
  if(closes.length<60) throw new Error('بيانات تاريخية غير كافية');
  const price=Number(meta?.regularMarketPrice)||closes.at(-1), prev=Number(meta?.previousClose||meta?.chartPreviousClose)||closes.at(-2), volume=Number(meta?.regularMarketVolume)||vols.at(-1)||0;
  const sma20=sma(closes,20), sma50=sma(closes,50), avgVol=average(vols.slice(-21,-1))||0, r=rsi(closes), rvol=avgVol?volume/avgVol:0;
  const momentumPct=closes.at(-6)?((price-closes.at(-6))/closes.at(-6))*100:0;
  const trend=clamp(50+((price/(sma50||sma20)-1)*500)); const volumeScore=clamp(45+(rvol-1)*35); const momentumScore=clamp(50+momentumPct*8); const rsiScore=r==null?50:clamp(100-Math.abs(r-55)*2);
  const priorHigh=Math.max(...highs.slice(-21,-1)), priorLow=Math.min(...lows.slice(-21,-1));
  const resistanceDist=price?((priorHigh-price)/price)*100:null; const breakout=clamp(100-((resistanceDist||0)*12));
  const bb=bollinger(closes), recentHigh=Math.max(...highs.slice(-5)), recentLow=Math.min(...lows.slice(-5)); const clusterRange=price?((recentHigh-recentLow)/price)*100:null; const cluster=clusterRange!=null&&clusterRange<=3.5&&rvol>=1.1;
  const support=Math.min(...lows.slice(-21,-1)); const stop=Math.min(price*.97,support*.995); const risk=price-stop, reward=priorHigh-price; const rr=reward>0&&risk>0?reward/risk:null; const riskScore=rr==null?25:rr>=3?100:rr>=2.5?90:rr>=2?80:rr>=1.5?65:rr>=1?45:25;
  let score=Math.round(momentumScore*.15+volumeScore*.15+trend*.15+breakout*.15+rsiScore*.10+bb.score*.10+(cluster?85:clusterRange<=5?60:25)*.10+riskScore*.10);
  if(resistanceDist!=null&&resistanceDist>=0&&resistanceDist<1)score-=12; else if(resistanceDist!=null&&resistanceDist<2)score-=7; score=clamp(score);
  const discovery=clamp(Math.round(50*.25+clamp(30+rvol*25,30,100)*.35+clamp(40+Math.abs((price-prev)/prev*100)*5,40,100)*.15+(volume>=1e6?100:volume>=5e5?80:volume>=1e5?60:30)*.25));
  const setup=Math.round(score*.85+discovery*.15); const signal=setup>=85?'STRONG_BUY':setup>=65?'BUY':setup>=50?'NEUTRAL':'AVOID';
  return {price,previousClose:prev,changePercent:prev?((price-prev)/prev)*100:0,volume,averageVolume20:Math.round(avgVol),relativeVolume:rvol,momentumPercent:momentumPct,momentumScore:Math.round(momentumScore),volumeScore:Math.round(volumeScore),trendScore:Math.round(trend),breakoutScore:Math.round(breakout),rsi:r==null?null:Number(r.toFixed(2)),rsiScore:Math.round(rsiScore),sma20:sma20&&Number(sma20.toFixed(2)),sma50:sma50&&Number(sma50.toFixed(2)),resistance20:Number(priorHigh.toFixed(2)),support20:Number(priorLow.toFixed(2)),resistanceDistancePercent:resistanceDist==null?null:Number(resistanceDist.toFixed(2)),bollingerBandwidth:bb.bandwidth==null?null:Number(bb.bandwidth.toFixed(2)),squeeze:bb.squeeze,squeezeScore:bb.score,cluster,clusterRangePercent:clusterRange==null?null:Number(clusterRange.toFixed(2)),clusterScore:cluster?85:clusterRange<=5?60:25,targetPrice:reward>0?Number(priorHigh.toFixed(2)):null,stopLoss:risk>0?Number(stop.toFixed(2)):null,riskReward:rr==null?null:Number(rr.toFixed(2)),riskScore,technicalScore:score,discoveryScore:discovery,setupScore:setup,signal,signalStrength:setup>=75?'HIGH':setup>=65?'MEDIUM':'LOW',directionBias:setup>=65?'ميل فني صاعد':setup<=40?'ميل فني هابط':'ميل فني محايد',riskLevel:setup>=75?'متوسط':setup>=55?'متوسط إلى مرتفع':'مرتفع',dayHigh:Number((highs.at(-1)||price).toFixed(2)),dayLow:Number((lows.at(-1)||price).toFixed(2)),dataAvailability:{price:true,volume:true,technicals:true,options:false,darkPool:false,institutionalFlow:false}};
}
const INDEX_SYMBOLS = [
  { symbol: '^IXIC', name: 'NASDAQ' },
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'QQQ' },
  { symbol: '^VIX', name: 'VIX' },
];

export async function fetchIndices(opts = {}) {
  const { timeout = 10000 } = opts;
  const settled = await Promise.allSettled(
    INDEX_SYMBOLS.map(async ({ symbol, name }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const chart = await fetchChart(symbol, '5d');
        if (!chart?.meta || !chart?.quote) throw new Error('No index data');
        const closes = (chart.quote?.close || []).map(Number).filter(Number.isFinite);
        const price = Number(chart.meta?.regularMarketPrice) || closes.at(-1);
        const previousClose = Number(chart.meta?.previousClose || chart.meta?.chartPreviousClose) || closes.at(-2);
        if (!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose <= 0) {
          throw new Error('Incomplete index data');
        }
        const change = ((price - previousClose) / previousClose) * 100;
        return { symbol, name, value: Number(price.toFixed(2)), change: Number(change.toFixed(2)), isUp: change >= 0, timestamp: new Date().toISOString() };
      } finally { clearTimeout(timer); }
    })
  );
  return settled.filter(s => s.status === 'fulfilled').map(s => s.value);
}

export async function fetchChart(symbol,range='6mo'){
 const clean=String(symbol||'').trim().toUpperCase(); if(!SYMBOL_RE.test(clean))throw new Error('رمز سهم غير صالح');
 const res=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=1d&range=${range}&events=div%2Csplits`,{headers:YAHOO_HEADERS,cache:'no-store'}); if(!res.ok)throw new Error(`Yahoo Finance ${res.status}`); const json=await res.json(), result=json?.chart?.result?.[0]; if(!result?.meta)throw new Error('No market data'); return {symbol:result.meta.symbol||clean,meta:result.meta,quote:result.indicators?.quote?.[0]||{},timestamps:result.timestamp||[]};
}
export async function fetchTrending(count=25){const res=await fetch(`https://query1.finance.yahoo.com/v1/finance/trending/US?count=${count}`,{headers:YAHOO_HEADERS,cache:'no-store'});if(!res.ok)throw new Error(`Yahoo trending ${res.status}`);const j=await res.json();return (j?.finance?.result?.[0]?.quotes||[]).map(x=>x?.symbol).filter(x=>SYMBOL_RE.test(x||''));}
