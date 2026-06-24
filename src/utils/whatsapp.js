// WhatsApp click-to-chat (deeplink) helpers.
//
// A wa.me deeplink is the customer's entry point into the WhatsApp channel: it
// opens WhatsApp with the support number selected and an optional message
// pre-filled. WhatsApp can't carry hidden metadata across a deeplink, so we
// embed a short reference code in the prefilled text (e.g. "Ref: TAC-AB12").
// The whatsapp-webhook Edge Function parses that code off the first inbound
// message to correlate the thread back to its originating context.
//
// The customer sending that first message is also what opens WhatsApp's
// 24-hour customer-service window, during which agents can reply with
// free-form text (no message template required).

// International support number in E.164, e.g. "+85512345678". Configured via env
// so the live number lives outside source control.
const SUPPORT_NUMBER_E164 = import.meta.env.VITE_WHATSAPP_SUPPORT_NUMBER || '';

// wa.me expects the number in international format with digits only — no leading
// '+', spaces, or dashes.
const toWaPhone = (raw) => String(raw || '').replace(/\D/g, '');

export const buildWhatsAppDeeplink = ({
  phone = SUPPORT_NUMBER_E164,
  message = '',
  refCode = '',
} = {}) => {
  const waPhone = toWaPhone(phone);

  const lines = [];
  if (message) lines.push(message);
  if (refCode) lines.push(`Ref: ${refCode}`);
  const text = lines.join('\n\n');

  const base = waPhone ? `https://wa.me/${waPhone}` : 'https://wa.me/';
  const query = text ? `?text=${encodeURIComponent(text)}` : '';

  return `${base}${query}`;
};

// Parser counterpart for the Edge Function side is implemented in the webhook;
// this client-only helper just generates links. Exposed for tests / reuse.
export const WHATSAPP_SUPPORT_NUMBER = SUPPORT_NUMBER_E164;
