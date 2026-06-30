-- Per-customer conversation state for the WhatsApp bot intake flow.
-- Mirrors facebook_bot_states / telegram_bot_states. Keyed by the customer's
-- wa_id (phone). The whatsapp-webhook (service role) is the only writer.
create table if not exists public.whatsapp_bot_states (
  id uuid primary key default gen_random_uuid(),
  whatsapp_wa_id text not null unique,
  whatsapp_phone_number_id text,
  full_name text,
  email text,
  issue_type text,
  issue_description text,
  state text not null default 'menu',
  current_session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_bot_states_wa_id_idx
  on public.whatsapp_bot_states (whatsapp_wa_id);

-- Service-role only (the Edge Function bypasses RLS); no anon/authenticated
-- access, matching the other *_bot_states tables.
alter table public.whatsapp_bot_states enable row level security;
