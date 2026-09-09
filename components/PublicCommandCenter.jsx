'use client';

import React, { useEffect, useRef } from 'react';
import CommandCenterView from '@/components/CommandCenterView';

const REPLACEMENTS = [
  ['DECISION PIPELINE', 'مسار القرار'],
  ['LIVE CONNECTIVITY', 'حالة الاتصال'],
  ['US Market Closed', 'السوق الأمريكي مغلق'],
  ['US Market Open', 'السوق الأمريكي مفتوح'],
  ['UNKNOWN', 'غير معروف'],
  ['NO DATA', 'لا توجد بيانات'],
  ['UNAVAILABLE', 'غير متاح'],
  ['CONNECTED', 'متصل'],
  ['DEGRADED', 'متدهور'],
  ['LOADING', 'جارٍ التحميل'],
  ['Discovery', 'الاكتشاف'],
  ['Decision', 'القرار'],
  ['opportunities', 'فرص'],
  ['plans', 'خطط'],
  ['Loading Command Center...', 'جارٍ تحميل مركز القيادة…'],
  ['No opportunities available', 'لا توجد فرص متاحة'],
  ['Top hunts will appear here', 'ستظهر أفضل الفرص هنا'],
  ['No trade plan available for this symbol', 'لا توجد خطة تداول متاحة لهذا السهم'],
  ['No evidence available for this symbol', 'لا توجد أدلة متاحة لهذا السهم'],
  ['Loading opportunities...', 'جارٍ تحميل الفرص…'],
  ['TOP OPPORTUNITIES', 'أفضل الفرص'],
  ['TRADE PLAN', 'خطة التداول'],
  ['EVIDENCE', 'الأدلة'],
  ['Sources', 'المصادر'],
  ['Strongest Evidence', 'أقوى الأدلة'],
  ['Weakest Evidence', 'أضعف الأدلة'],
  ['Data Quality', 'جودة البيانات'],
  ['Provenance', 'مصادر البيانات'],
  ['Entry', 'الدخول'],
  ['Stop Loss', 'وقف الخسارة'],
  ['Invalidation', 'نقطة الإبطال'],
  ['Target 1', 'الهدف الأول'],
  ['Target 2', 'الهدف الثاني'],
  ['Score', 'الدرجة'],
  ['SWING 1-3M', 'تأرجح 1–3 أشهر'],
  ['INTRADAY', 'يومي'],
];

function localizeText(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);

  for (const textNode of nodes) {
    let text = textNode.nodeValue;
    if (!text || !text.trim()) continue;

    if (text.includes('LIVE CONNECTIVITY') || (text.includes('api/stocks/') && text.includes('api/health/'))) {
      let parent = textNode.parentElement;
      while (parent && parent !== root) {
        if (parent.textContent.includes('api/stocks/') && parent.textContent.includes('api/health/')) {
          parent.style.display = 'none';
          break;
        }
        parent = parent.parentElement;
      }
      continue;
    }

    if (text.includes('DECISION PIPELINE') && text.includes('DISCOVERY') && text.includes('C9')) {
      let parent = textNode.parentElement;
      while (parent && parent !== root) {
        if (parent.textContent.includes('DISCOVERY') && parent.textContent.includes('C8') && parent.textContent.includes('C9')) {
          parent.style.display = 'none';
          break;
        }
        parent = parent.parentElement;
      }
      continue;
    }

    for (const [from, to] of REPLACEMENTS) text = text.replaceAll(from, to);
    if (text !== textNode.nodeValue) textNode.nodeValue = text;
  }
}

export default function PublicCommandCenter() {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    const apply = () => localizeText(root);
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} dir="rtl"><CommandCenterView /></div>;
}
