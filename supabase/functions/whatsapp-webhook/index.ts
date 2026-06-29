import { createClient } from 'npm:@supabase/supabase-js@2';

// Inbound webhook for the WhatsApp Cloud API. Writes customer conversations
// into chat_sessions / chat_messages (no tickets), mirroring facebook-webhook.
// Customer identity = wa_id (phone). Open sessions are reused; otherwise a new
// session is created and auto-assigned to an online support agent. Keeps a few
// console.error/warn breadcrumbs for ops but no verbose payload tracing.

const GRAPH_API_VERSION = 'v21.0';
const SESSION_DURATION_MINUTES = 20;
const MAX_ACTIVE_SESSIONS_PER_AGENT = 5;
const ONLINE_AGENT_WINDOW_MINUTES = 2;

const SUPPORT_AGENT_ROLES = ['Customer Service Agent', 'Customer Support Agent'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const textResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const getExpiryIso = () =>
  new Date(Date.now() + SESSION_DURATION_MINUTES * 60 * 1000).toISOString();

const normalizeRole = (role: unknown) => String(role || '').trim().toLowerCase();
const isSupportAgentRole = (role: unknown) => {
  const n = normalizeRole(role);
  return n === 'customer service agent' || n === 'customer support agent';
};

// Pull a "Ref: <code>" line out of the prefilled deeplink message, if present.
const parseRefCode = (text: string): string | null => {
  const m = String(text || '').match(/ref[:\s]+([A-Za-z0-9._-]{3,64})/i);
  return m ? m[1] : null;
};

/* ===== Meta signature verification (HMAC-SHA256 over the raw body) ===== */

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

const secureCompare = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

const verifyMetaSignature = async ({ rawBody, signatureHeader, appSecret }: { rawBody: string; signatureHeader: string | null; appSecret: string; }) => {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const received = signatureHeader.replace('sha256=', '');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  return secureCompare(bytesToHex(new Uint8Array(sig)), received);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
    const whatsappToken = Deno.env.get('WHATSAPP_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!verifyToken) throw new Error('Missing WHATSAPP_VERIFY_TOKEN.');

    // Meta verification handshake.
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const receivedToken = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && receivedToken === verifyToken && challenge) return textResponse(challenge, 200);
      return textResponse('Forbidden', 403);
    }

    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);

    if (!appSecret) throw new Error('Missing WHATSAPP_APP_SECRET.');
    if (!whatsappToken) throw new Error('Missing WHATSAPP_TOKEN.');
    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL.');
    if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');

    const rawBody = await req.text();
    const signatureHeader = req.headers.get('x-hub-signature-256');
    const valid = await verifyMetaSignature({ rawBody, signatureHeader, appSecret });

    if (!valid) {
      console.warn('[wa] Rejected invalid webhook signature.');
      return jsonResponse({ ok: false, error: 'Invalid webhook signature.' }, 401);
    }

    const payload = JSON.parse(rawBody);
    if (payload.object !== 'whatsapp_business_account') {
      return jsonResponse({ ok: true, ignored: true }, 200);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        // value.statuses[] (delivery/read receipts) arrive on this same field
        // but carry no `messages` array, so they're naturally skipped below.
        if (change.field !== 'messages') continue;
        const value = change.value || {};
        const phoneNumberId = String(value.metadata?.phone_number_id || '');
        const contacts = value.contacts || [];
        const messages = value.messages || [];
        for (const message of messages) {
          try {
            await handleWhatsAppMessage({ supabase, whatsappToken, phoneNumberId, contacts, message });
          } catch (err) {
            console.error('[wa] handleWhatsAppMessage failed:', err instanceof Error ? err.message : err);
          }
        }
      }
    }

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    console.error('[wa] whatsapp-webhook error:', error instanceof Error ? error.message : error);
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'WhatsApp webhook failed.' }, 500);
  }
});

async function handleWhatsAppMessage({ supabase, whatsappToken, phoneNumberId, contacts, message }: { supabase: any; whatsappToken: string; phoneNumberId: string; contacts: any[]; message: any; }) {
  const waId = String(message.from || contacts?.[0]?.wa_id || '').trim();
  if (!waId) return;

  const profileName = contacts?.find((c: any) => String(c.wa_id) === waId)?.profile?.name || contacts?.[0]?.profile?.name || 'WhatsApp Customer';
  const text = extractMessageText(message);
  const whatsappMessageId = String(message.id || '');

  // Idempotency: WhatsApp retries webhooks, so skip a message already stored.
  if (whatsappMessageId) {
    const { data: existingMessage } = await supabase.from('chat_messages').select('id').contains('metadata', { whatsappMessageId }).limit(1).maybeSingle();
    if (existingMessage) return;
  }

  const customer = await upsertWhatsAppCustomer({ supabase, waId, phoneNumberId, fullName: profileName });
  const existingSession = await findOpenSessionForWhatsAppUser({ supabase, waId });
  if (existingSession) {
    await appendCustomerMessage({ supabase, session: existingSession, waId, phoneNumberId, text, whatsappMessageId });
    return;
  }

  const refCode = parseRefCode(text);
  let selectedAgent = await findAvailableAgentForSession(supabase);
  if (selectedAgent && !isSupportAgentRole(selectedAgent.role)) selectedAgent = null;

  const assignedAgentName = selectedAgent ? selectedAgent.full_name || 'Support Agent' : null;
  const sessionExpiry = selectedAgent ? getExpiryIso() : null;
  const nowIso = new Date().toISOString();

  const sessionMetadata: Record<string, unknown> = {
    source: 'whatsapp', channel: 'WhatsApp', whatsappWaId: waId, whatsappPhoneNumberId: phoneNumberId,
    customerId: customer.id, customerName: profileName, phone: waId, assignedAgentName,
    assignedAgentEmail: selectedAgent?.email || null, assignedAgentRole: selectedAgent?.role || null,
    expiresAt: sessionExpiry, warningSentAt: null, lastActivityAt: nowIso,
  };
  if (refCode) sessionMetadata.deeplinkRef = refCode;

  const { data: session, error: sessionError } = await supabase.from('chat_sessions').insert({
    session_number: `WA-${Date.now()}`,
    user_id: waId, customer_id: customer.id, status: selectedAgent ? 'active' : 'waiting',
    agent_id: selectedAgent?.id ? String(selectedAgent.id) : null, assigned_agent_id: selectedAgent?.id || null,
    assigned_agent_name: assignedAgentName, channel: 'WhatsApp', last_message: text || '[Unsupported message]',
    expires_at: sessionExpiry, warning_sent_at: null, metadata: sessionMetadata,
  }).select().single();

  if (sessionError) throw sessionError;

  const { error: msgErr } = await supabase.from('chat_messages').insert({
    session_id: session.id, sender_role: 'user', sender_id: waId, content: text || '[Unsupported message]',
    metadata: { source: 'whatsapp', whatsappWaId: waId, whatsappPhoneNumberId: phoneNumberId, whatsappMessageId, ...(refCode ? { deeplinkRef: refCode } : {}) },
  });
  if (msgErr) console.error('[wa] chat_messages insert error:', msgErr.message);

  await sendWhatsAppText({ whatsappToken, phoneNumberId, recipientWaId: waId, text: selectedAgent ? 'Thank you for contacting T.A Coin support. You are now connected with our team — please describe your issue and an agent will reply shortly.' : 'Thank you for contacting T.A Coin support. All agents are currently busy, so your chat has been added to the queue. We will reply as soon as possible.' });
}

function extractMessageText(message: any): string {
  const type = String(message.type || '');
  if (type === 'text') return String(message.text?.body || '').trim();
  if (type === 'interactive') {
    const i = message.interactive || {};
    return String(i.button_reply?.title || i.list_reply?.title || '').trim();
  }
  if (type === 'button') return String(message.button?.text || '').trim();
  // image / document / audio / location etc. — attachment relay is a later phase.
  return `[${type || 'unsupported'} message received]`;
}

async function appendCustomerMessage({ supabase, session, waId, phoneNumberId, text, whatsappMessageId }: { supabase: any; session: any; waId: string; phoneNumberId: string; text: string; whatsappMessageId: string; }) {
  const { error: msgErr } = await supabase.from('chat_messages').insert({
    session_id: session.id, sender_role: 'user', sender_id: waId, content: text || '[Unsupported message]',
    metadata: { source: 'whatsapp', whatsappWaId: waId, whatsappPhoneNumberId: phoneNumberId, whatsappMessageId },
  });
  if (msgErr) console.error('[wa] append chat_messages insert error:', msgErr.message);
  const metadata = session.metadata && typeof session.metadata === 'object' ? session.metadata : {};
  const nowIso = new Date().toISOString();
  const newExpiry = getExpiryIso();
  await supabase.from('chat_sessions').update({
    last_message: text || '[Unsupported message]', last_customer_message_at: nowIso, updated_at: nowIso,
    expires_at: newExpiry, warning_sent_at: null,
    metadata: { ...metadata, expiresAt: newExpiry, warningSentAt: null, lastActivityAt: nowIso },
  }).eq('id', session.id);
}

async function upsertWhatsAppCustomer({ supabase, waId, phoneNumberId, fullName }: { supabase: any; waId: string; phoneNumberId: string; fullName: string; }) {
  const { data: existing } = await supabase.from('customers').select('*').eq('whatsapp_wa_id', waId).maybeSingle();
  if (existing) {
    const { data, error } = await supabase.from('customers').update({ full_name: existing.full_name || fullName, phone: existing.phone || waId, whatsapp_wa_id: waId, whatsapp_phone_number_id: phoneNumberId, source_channel: 'WhatsApp' }).eq('id', existing.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('customers').insert({ full_name: fullName, phone: waId, whatsapp_wa_id: waId, whatsapp_phone_number_id: phoneNumberId, source_channel: 'WhatsApp' }).select().single();
  if (error) throw error;
  return data;
}

async function findOpenSessionForWhatsAppUser({ supabase, waId }: { supabase: any; waId: string; }) {
  const { data, error } = await supabase.from('chat_sessions').select('*').eq('user_id', waId).eq('channel', 'WhatsApp').in('status', ['active', 'waiting', 'idle warning']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) { console.warn('[wa] findOpenSession error:', error.message); return null; }
  return data;
}

async function findAvailableAgentForSession(supabase: any) {
  const cutoff = new Date(Date.now() - ONLINE_AGENT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: presenceRows, error: presenceError } = await supabase.from('agent_presence').select('agent_id, full_name, email, role, presence_status, agent_status, last_seen_at').eq('presence_status', 'Online').eq('agent_status', 'Available').in('role', SUPPORT_AGENT_ROLES).gte('last_seen_at', cutoff);
  if (presenceError) { console.warn('[wa] presence error:', presenceError.message); return null; }
  const valid = (presenceRows || []).filter((r: any) => isSupportAgentRole(r.role));
  const ids = valid.map((r: any) => r.agent_id).filter(Boolean);
  if (ids.length === 0) return null;
  const { data: agentRows, error: agentError } = await supabase.from('agents').select('id, full_name, email, role, status').in('id', ids).eq('status', 'Available').in('role', SUPPORT_AGENT_ROLES);
  if (agentError) throw agentError;
  const supportAgents = (agentRows || []).filter((a: any) => isSupportAgentRole(a.role));
  if (supportAgents.length === 0) return null;
  const { data: activeSessions, error: sessionError } = await supabase.from('chat_sessions').select('id, agent_id, assigned_agent_id, status').eq('status', 'active');
  if (sessionError) throw sessionError;
  const list = activeSessions || [];
  const withLoad = supportAgents.map((a: any) => {
    const c = list.filter((s: any) => { const id = s.assigned_agent_id || s.agent_id || null; return id && String(id) === String(a.id); }).length;
    return { ...a, activeCount: c, isBusy: c >= MAX_ACTIVE_SESSIONS_PER_AGENT };
  });
  const eligible = withLoad.filter((a: any) => !a.isBusy && isSupportAgentRole(a.role));
  if (eligible.length === 0) return null;
  const lowest = Math.min(...eligible.map((a: any) => a.activeCount));
  const least = eligible.filter((a: any) => a.activeCount === lowest);
  return least[Math.floor(Math.random() * least.length)] || null;
}

async function sendWhatsAppText({ whatsappToken, phoneNumberId, recipientWaId, text }: { whatsappToken: string; phoneNumberId: string; recipientWaId: string; text: string; }) {
  if (!phoneNumberId) { console.warn('[wa] cannot send: missing phone_number_id'); return null; }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipientWaId, type: 'text', text: { preview_url: false, body: text } }),
  });
  const result = await res.json();
  if (!res.ok || result?.error) { console.error('[wa] outbound send failed:', JSON.stringify(result?.error || result)); return null; }
  return result;
}
