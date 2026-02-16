import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = '8522381806:AAHqrxrb_3irbG30NaO7K6QX2nq0HCz0HIs';
const TELEGRAM_CHAT_IDS = [
  '-5022175580',   // Group: "bot"
];
const MONITOR_API = 'http://148.251.66.154:3099';

// Check if a specific notification pattern is enabled
async function isPatternEnabled(patternName: string): Promise<boolean> {
  try {
    const res = await fetch(`${MONITOR_API}/status`, {
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    if (!res.ok) return true; // Default to enabled if API fails
    const data = await res.json();

    // If notifications globally disabled, return false
    if (!data.enabled) return false;

    // Find the specific pattern
    const pattern = data.patterns?.find((p: { name: string; enabled: boolean }) =>
      p.name === patternName
    );

    // If pattern not found, default to enabled
    return pattern ? pattern.enabled : true;
  } catch (error) {
    console.error('Failed to check pattern status:', error);
    return true; // Default to enabled if API fails
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, timestamp, pattern } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // If pattern specified, check if it's enabled
    if (pattern) {
      const enabled = await isPatternEnabled(pattern);
      if (!enabled) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: `Pattern "${pattern}" is disabled`
        });
      }
    }

    const text = timestamp
      ? `🔔 ${message}\n\n⏰ ${new Date(timestamp).toLocaleString()}`
      : `🔔 ${message}`;

    // Send to all chat IDs
    const results = await Promise.all(
      TELEGRAM_CHAT_IDS.map(async (chatId) => {
        try {
          const response = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
              }),
            }
          );
          const data = await response.json();
          return { chatId, success: data.ok, message_id: data.result?.message_id };
        } catch (err) {
          console.error(`Failed to send to ${chatId}:`, err);
          return { chatId, success: false, error: err };
        }
      })
    );

    const allSuccess = results.every((r) => r.success);
    if (!allSuccess) {
      console.error('Some Telegram messages failed:', results.filter((r) => !r.success));
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send notification' },
      { status: 500 }
    );
  }
}
