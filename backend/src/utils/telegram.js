const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Send notification to Telegram chat
async function sendTelegramNotification(chatId, text, options = {}) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram] Bot token not configured');
    return false;
  }

  if (!chatId) {
    console.warn('[Telegram] No chat ID provided');
    return false;
  }

  try {
    const payload = {
      chat_id: String(chatId),
      text: text,
      parse_mode: options.parseMode || 'Markdown',
      disable_web_page_preview: options.disablePreview !== false
    };

    if (options.replyMarkup) {
      payload.reply_markup = options.replyMarkup;
    }

    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 5000
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Telegram] Send failed:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[Telegram] Error sending notification:', e.message);
    return false;
  }
}

// Format notification for incoming call
function formatCallNotification(caller, options = {}) {
  const name = caller.name || 'Friend';
  const callType = options.callType === 'video' ? '🎥 Video' : '📞 Voice';
  const text = options.missed
    ? `📵 *Missed ${callType.toLowerCase()} call* from *${name}*`
    : `${callType} *call* from *${name}*\n\n_Open Pastel Chat to answer_`;
  return text;
}

// Build inline keyboard for opening the app
function buildOpenAppButton(baseUrl, callParams = null) {
  const base = baseUrl || process.env.CLIENT_URL || 'https://pastel-chat.vercel.app';
  let url = base;
  if (callParams) {
    const params = new URLSearchParams({
      action: 'incoming-call',
      callType: callParams.callType || 'voice',
      callerName: callParams.callerName || 'Friend',
      ...(callParams.callerId && { callerId: callParams.callerId }),
      ...(callParams.callerAvatar && { callerAvatar: callParams.callerAvatar })
    });
    url = `${base}?${params.toString()}`;
  }
  return {
    inline_keyboard: [[
      { text: '📲 Open Pastel Chat', url }
    ]]
  };
}

// Format notification for friend request
function formatFriendRequestNotification(requester) {
  const name = requester.name || 'Friend';
  return `👤 Friend request from *${name}*\n\nTap to view in Pastel Chat`;
}

// Format notification for message
function formatMessageNotification(sender, message, options = {}) {
  const senderName = sender.name || 'Friend';
  const preview = (message || '').slice(0, 50);
  const text = preview
    ? `💬 *${senderName}*: ${preview}${message.length > 50 ? '…' : ''}`
    : `💬 Message from *${senderName}*`;
  return text;
}

// Format notification for sticker
function formatStickerNotification(sender) {
  const senderName = sender.name || 'Friend';
  return `✨ *${senderName}* sent a sticker`;
}

// Format notification for GIF
function formatGifNotification(sender) {
  const senderName = sender.name || 'Friend';
  return `🎬 *${senderName}* sent a GIF`;
}

module.exports = {
  sendTelegramNotification,
  formatCallNotification,
  buildOpenAppButton,
  formatFriendRequestNotification,
  formatMessageNotification,
  formatStickerNotification,
  formatGifNotification
};
