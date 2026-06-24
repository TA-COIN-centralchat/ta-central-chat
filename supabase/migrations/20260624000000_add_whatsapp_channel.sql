-- WhatsApp channel support for central chat.
--
-- The whatsapp-webhook / send-whatsapp-reply Edge Functions identify a WhatsApp
-- customer by their wa_id (their phone number in international format) and need
-- to remember which business phone number the conversation belongs to. These
-- columns mirror the existing facebook_sender_id / facebook_page_id pair.
--
-- No schema change is required on chat_sessions: WhatsApp sessions are stored
-- with channel = 'WhatsApp' plus wa_id details in metadata, exactly like the
-- Telegram and Facebook channels.

alter table public.customers
  add column if not exists whatsapp_wa_id text,
  add column if not exists whatsapp_phone_number_id text;

create index if not exists customers_whatsapp_wa_id_idx
  on public.customers (whatsapp_wa_id);

-- Keeps the per-channel inbox query fast as WhatsApp volume grows:
-- getSessionsByChannel pulls recent rows then filters by channel client-side.
create index if not exists chat_sessions_channel_idx
  on public.chat_sessions (channel);
