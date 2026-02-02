type AlertPayload = {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error' | 'urgent';
  data?: Record<string, any>;
};

async function postWebhook(url: string, payload: AlertPayload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn('[alerts] webhook failed', url, res.status);
    }
  } catch (e) {
    console.warn('[alerts] webhook error', url, e);
  }
}

export async function sendAlertToChannels(payload: AlertPayload) {
  const urls = [
    process.env.INVENTORY_ALERT_WEBHOOK_URL,
    process.env.INVENTORY_EMAIL_WEBHOOK_URL,
    process.env.INVENTORY_SLACK_WEBHOOK_URL,
    process.env.INVENTORY_KAKAO_WEBHOOK_URL,
  ].filter(Boolean) as string[];

  if (urls.length === 0) return;
  await Promise.all(urls.map((url) => postWebhook(url, payload)));
}
