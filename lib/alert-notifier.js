async function fetchWithOneRetry(url, options) {
  try {
    const response = await fetch(url, options);
    if (response.ok) return response;
    if (response.status >= 500) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetch(url, options);
    }
    return response;
  } catch (error) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return fetch(url, options);
  }
}

export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const r = await fetchWithOneRetry(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  return r.ok;
}

export async function sendDiscord(text) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return false;
  const r = await fetchWithOneRetry(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'HUNTER AI', content: text.replace(/<[^>]+>/g, ''), allowed_mentions: { parse: [] } }),
  });
  return r.ok;
}
