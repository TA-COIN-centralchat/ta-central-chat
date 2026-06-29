// Channel detection helpers.
//
// Telegram chat sessions arrive from three different code paths (the bot, the
// dashboard inbox, and bulk loaders) and any of those paths can leave the
// `channel` column blank, so we have to recognize Telegram by combining a
// bunch of weakly-typed signals from metadata, the customers row, and the
// shape of user_id itself.
//
// This logic was previously duplicated in LiveChatPage, sessionService, and
// realtimeChat. Keep the canonical copy here.

const TELEGRAM_CHAT_ID_RE = /^-?\d{6,}$/;

export const hasTelegramSignal = (session) => {
  if (!session) return false;

  const sessionChannel = String(session.channel || '').toLowerCase().trim();
  const metadataChannel = String(session.metadata?.channel || '')
    .toLowerCase()
    .trim();
  const customerSource = String(session.customers?.source_channel || '')
    .toLowerCase()
    .trim();
  const userId = String(session.user_id || '').trim();
  const meta = session.metadata || {};

  return (
    Boolean(meta.telegramUsername) ||
    Boolean(meta.telegramChatId) ||
    Boolean(meta.telegram_username) ||
    Boolean(meta.telegram_chat_id) ||
    Boolean(meta.telegram_user_id) ||
    Boolean(meta.telegram) ||
    Boolean(meta.tg_id) ||
    Boolean(meta.tg_username) ||
    Boolean(session.customers?.telegram_username) ||
    sessionChannel.includes('telegram') ||
    sessionChannel === 'tg' ||
    metadataChannel.includes('telegram') ||
    customerSource.includes('telegram') ||
    TELEGRAM_CHAT_ID_RE.test(userId)
  );
};

// WhatsApp Cloud API sessions are created by the whatsapp-webhook Edge Function,
// which always stamps channel='WhatsApp' plus the customer's wa_id (phone) into
// metadata / the customers row. We only rely on those explicit markers — unlike
// Telegram we deliberately avoid sniffing a numeric user_id, because a WhatsApp
// wa_id is a bare phone number that would collide with other numeric ids.
export const hasWhatsAppSignal = (session) => {
  if (!session) return false;

  const sessionChannel = String(session.channel || '').toLowerCase().trim();
  const metadataChannel = String(session.metadata?.channel || '')
    .toLowerCase()
    .trim();
  const customerSource = String(session.customers?.source_channel || '')
    .toLowerCase()
    .trim();
  const meta = session.metadata || {};

  return (
    Boolean(meta.whatsappWaId) ||
    Boolean(meta.whatsapp_wa_id) ||
    Boolean(meta.whatsappPhoneNumberId) ||
    Boolean(meta.whatsapp_phone_number_id) ||
    Boolean(meta.whatsapp) ||
    Boolean(session.customers?.whatsapp_wa_id) ||
    sessionChannel.includes('whatsapp') ||
    sessionChannel === 'wa' ||
    metadataChannel.includes('whatsapp') ||
    customerSource.includes('whatsapp')
  );
};

export const isLiveChatSession = (session) => {
  if (!session) return false;
  return !hasTelegramSignal(session) && !hasWhatsAppSignal(session);
};

export const matchesChannel = (session, channel) => {
  const target = String(channel || '').toLowerCase().trim();
  const telegramish = hasTelegramSignal(session);
  const whatsappish = hasWhatsAppSignal(session);

  if (target === 'telegram') return telegramish;
  if (target === 'whatsapp') return whatsappish;
  // Website Chatbot is the catch-all for first-party web sessions: anything
  // that isn't routed through an external relay channel (Telegram / WhatsApp).
  if (target === 'website chatbot') return !telegramish && !whatsappish;

  const sessionChannel = String(session.channel || '').toLowerCase().trim();
  const metadataChannel = String(session.metadata?.channel || '')
    .toLowerCase()
    .trim();

  return sessionChannel === target || metadataChannel === target;
};
