import { createClient } from 'npm:@supabase/supabase-js@2';

// Inbound webhook for the WhatsApp Cloud API. Writes customer conversations
// into chat_sessions / chat_messages (no tickets). Inbound media (image / voice
// / audio / video / document) is downloaded from the Graph API and stored in
// Supabase Storage, using the SAME chat_messages metadata shape as the Telegram
// webhook so the dashboard renders it with no UI changes.

const GRAPH_API_VERSION = 'v21.0';
const SESSION_DURATION_MINUTES = 20;
const MAX_ACTIVE_SESSIONS_PER_AGENT = 5;
const ONLINE_AGENT_WINDOW_MINUTES = 2;

const ATTACHMENT_BUCKET = 'attachments';
const VOICE_BUCKET = 'voice-messages';

const SUPPORT_AGENT_ROLES = ['Customer Service Agent', 'Customer Support Agent'];

const PLACEHOLDER_BY_KIND: Record<string, string> = {
  voice: '[Voice message]',
  audio: '[Audio]',
  image: '[Image]',
  video: '[Video]',
  document: '[Attachment]',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const textResponse = (b: string, s = 200) => new Response(b, { status: s, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
const jsonResponse = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const getExpiryIso = () => new Date(Date.now() + SESSION_DURATION_MINUTES * 60 * 1000).toISOString();
const normalizeRole = (r: unknown) => String(r || '').trim().toLowerCase();
const isSupportAgentRole = (r: unknown) => { const n = normalizeRole(r); return n === 'customer service agent' || n === 'customer support agent'; };
const parseRefCode = (t: string): string | null => { const m = String(t || '').match(/ref[:\s]+([A-Za-z0-9._-]{3,64})/i); return m ? m[1] : null; };
const bytesToHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
const secureCompare = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
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
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const rt = url.searchParams.get('hub.verify_token');
      const ch = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && rt === verifyToken && ch) return textResponse(ch, 200);
      return textResponse('Forbidden', 403);
    }
    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
    if (!appSecret) throw new Error('Missing WHATSAPP_APP_SECRET.');
    if (!whatsappToken) throw new Error('Missing WHATSAPP_TOKEN.');
    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL.');
    if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');
    const rawBody = await req.text();
    const valid = await verifyMetaSignature({ rawBody, signatureHeader: req.headers.get('x-hub-signature-256'), appSecret });
    if (!valid) { console.warn('[wa] Rejected invalid webhook signature.'); return jsonResponse({ ok: false, error: 'Invalid webhook signature.' }, 401); }
    const payload = JSON.parse(rawBody);
    if (payload.object !== 'whatsapp_business_account') return jsonResponse({ ok: true, ignored: true }, 200);
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        // value.statuses[] (delivery/read receipts) are acknowledged and ignored.
        if (change.field !== 'messages') continue;
        const value = change.value || {};
        const phoneNumberId = String(value.metadata?.phone_number_id || '');
        const contacts = value.contacts || [];
        const messages = value.messages || [];
        for (const message of messages) {
          try { await handleWhatsAppMessage({ supabase, whatsappToken, phoneNumberId, contacts, message }); }
          catch (err) { console.error('[wa] handleWhatsAppMessage failed:', err instanceof Error ? err.message : err); }
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
  const whatsappMessageId = String(message.id || '');

  // Idempotency: WhatsApp retries webhooks, so skip a message already stored.
  if (whatsappMessageId) {
    const { data: existingMessage } = await supabase.from('chat_messages').select('id').contains('metadata', { whatsappMessageId }).limit(1).maybeSingle();
    if (existingMessage) return;
  }

  const media = extractMediaInfo(message);
  const textBody = ['text', 'interactive', 'button'].includes(String(message.type)) ? extractMessageText(message) : '';
  const content = (media?.caption || textBody || (media ? PLACEHOLDER_BY_KIND[media.kind] : extractMessageText(message)) || '').trim() || '[Unsupported message]';
  const refCode = parseRefCode(content);

  const customer = await upsertWhatsAppCustomer({ supabase, waId, phoneNumberId, fullName: profileName });

  let session = await findOpenSessionForWhatsAppUser({ supabase, waId });
  let isNew = false;
  if (!session) {
    let selectedAgent = await findAvailableAgentForSession(supabase);
    if (selectedAgent && !isSupportAgentRole(selectedAgent.role)) selectedAgent = null;
    const assignedAgentName = selectedAgent ? selectedAgent.full_name || 'Support Agent' : null;
    const sessionExpiry = selectedAgent ? getExpiryIso() : null;
    const nowIso = new Date().toISOString();
    const sessionMetadata: Record<string, unknown> = { source: 'whatsapp', channel: 'WhatsApp', whatsappWaId: waId, whatsappPhoneNumberId: phoneNumberId, customerId: customer.id, customerName: profileName, phone: waId, assignedAgentName, assignedAgentEmail: selectedAgent?.email || null, assignedAgentRole: selectedAgent?.role || null, expiresAt: sessionExpiry, warningSentAt: null, lastActivityAt: nowIso };
    if (refCode) sessionMetadata.deeplinkRef = refCode;
    const { data, error } = await supabase.from('chat_sessions').insert({ session_number: `WA-${Date.now()}`, user_id: waId, customer_id: customer.id, status: selectedAgent ? 'active' : 'waiting', agent_id: selectedAgent?.id ? String(selectedAgent.id) : null, assigned_agent_id: selectedAgent?.id || null, assigned_agent_name: assignedAgentName, channel: 'WhatsApp', last_message: content, expires_at: sessionExpiry, warning_sent_at: null, metadata: sessionMetadata }).select().single();
    if (error) throw error;
    session = data; isNew = true;
  }

  // Download + store any media now that we have the session id for the path.
  const attachment = media?.mediaId
    ? await downloadAndStoreWhatsAppMedia({ supabase, token: whatsappToken, media, sessionId: session.id })
    : null;

  const messageMetadata: Record<string, unknown> = {
    source: 'whatsapp', whatsappWaId: waId, whatsappPhoneNumberId: phoneNumberId, whatsappMessageId,
    ...(refCode ? { deeplinkRef: refCode } : {}),
    ...(attachment ? { attachment_url: attachment.url, bucket: attachment.bucket, storagePath: attachment.storagePath, mimeType: attachment.mimeType, fileName: attachment.fileName, kind: attachment.kind, ...(attachment.durationSec != null ? { duration: attachment.durationSec } : {}) } : {}),
  };

  const { error: msgErr } = await supabase.from('chat_messages').insert({ session_id: session.id, sender_role: 'user', sender_id: waId, content, attachment_url: attachment?.url || null, metadata: messageMetadata });
  if (msgErr) console.error('[wa] chat_messages insert error:', msgErr.message);

  if (!isNew) {
    const metadata = session.metadata && typeof session.metadata === 'object' ? session.metadata : {};
    const nowIso = new Date().toISOString(); const newExpiry = getExpiryIso();
    await supabase.from('chat_sessions').update({ last_message: content, last_customer_message_at: nowIso, updated_at: nowIso, expires_at: newExpiry, warning_sent_at: null, metadata: { ...metadata, expiresAt: newExpiry, warningSentAt: null, lastActivityAt: nowIso } }).eq('id', session.id);
  }

  if (isNew) {
    const assigned = Boolean(session.assigned_agent_id);
    await sendWhatsAppText({ whatsappToken, phoneNumberId, recipientWaId: waId, text: assigned ? 'Thank you for contacting T.A Coin support. You are now connected with our team — please describe your issue and an agent will reply shortly.' : 'Thank you for contacting T.A Coin support. All agents are currently busy, so your chat has been added to the queue. We will reply as soon as possible.' });
  }
}

function extractMessageText(message: any): string {
  const type = String(message.type || '');
  if (type === 'text') return String(message.text?.body || '').trim();
  if (type === 'interactive') { const i = message.interactive || {}; return String(i.button_reply?.title || i.list_reply?.title || '').trim(); }
  if (type === 'button') return String(message.button?.text || '').trim();
  return `[${type || 'unsupported'} message received]`;
}

// Map a WhatsApp media message to the download/storage descriptor. Returns null
// for non-media messages.
function extractMediaInfo(message: any): { mediaId: string; kind: string; mimeType: string; fileName: string; caption: string; durationSec: number | null } | null {
  const type = String(message.type || '');
  const ts = Date.now();
  if (type === 'image' && message.image?.id) {
    return { mediaId: message.image.id, kind: 'image', mimeType: message.image.mime_type || 'image/jpeg', fileName: `image_${ts}.jpg`, caption: String(message.image.caption || '').trim(), durationSec: null };
  }
  if (type === 'sticker' && message.sticker?.id) {
    return { mediaId: message.sticker.id, kind: 'image', mimeType: message.sticker.mime_type || 'image/webp', fileName: `sticker_${ts}.webp`, caption: '', durationSec: null };
  }
  if (type === 'audio' && message.audio?.id) {
    const isVoice = Boolean(message.audio.voice);
    const mime = message.audio.mime_type || 'audio/ogg';
    const ext = mime.includes('ogg') ? 'oga' : (mime.split('/')[1] || 'mp3').split(';')[0].replace('mpeg', 'mp3');
    return { mediaId: message.audio.id, kind: isVoice ? 'voice' : 'audio', mimeType: mime, fileName: `${isVoice ? 'voice' : 'audio'}_${ts}.${ext}`, caption: '', durationSec: null };
  }
  if (type === 'video' && message.video?.id) {
    return { mediaId: message.video.id, kind: 'video', mimeType: message.video.mime_type || 'video/mp4', fileName: `video_${ts}.mp4`, caption: String(message.video.caption || '').trim(), durationSec: null };
  }
  if (type === 'document' && message.document?.id) {
    return { mediaId: message.document.id, kind: 'document', mimeType: message.document.mime_type || 'application/octet-stream', fileName: message.document.filename || `file_${ts}`, caption: String(message.document.caption || '').trim(), durationSec: null };
  }
  return null;
}

// Two-step WhatsApp media download: GET /{media-id} -> { url }, then GET that
// url (both require the bearer token), then upload to Supabase Storage. Audio /
// voice go to the voice bucket; everything else to the attachments bucket
// (mirrors the Telegram webhook).
async function downloadAndStoreWhatsAppMedia({ supabase, token, media, sessionId }: { supabase: any; token: string; media: { mediaId: string; kind: string; mimeType: string; fileName: string; durationSec?: number | null }; sessionId: string; }) {
  try {
    const bucket = media.kind === 'voice' || media.kind === 'audio' ? VOICE_BUCKET : ATTACHMENT_BUCKET;
    const storagePath = `whatsapp/${sessionId}/${media.fileName}`;

    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(media.mediaId)}`, { headers: { Authorization: `Bearer ${token}` } });
    const metaData = await metaRes.json();
    if (!metaRes.ok || !metaData?.url) { console.error('[wa] media lookup failed:', JSON.stringify(metaData?.error || metaData)); return null; }

    const binRes = await fetch(metaData.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!binRes.ok) { console.error('[wa] media download failed:', binRes.status, binRes.statusText); return null; }
    const blob = await binRes.blob();
    const resolvedMime = metaData.mime_type || media.mimeType || blob.type || 'application/octet-stream';

    const { error: upErr } = await supabase.storage.from(bucket).upload(storagePath, blob, { contentType: resolvedMime, upsert: false });
    if (upErr) { console.error(`[wa] storage upload error (${bucket}):`, upErr.message); return null; }

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return { url: pub?.publicUrl || null, bucket, storagePath, mimeType: resolvedMime, fileName: media.fileName, kind: media.kind, durationSec: media.durationSec ?? null };
  } catch (e) {
    console.error('[wa] downloadAndStoreWhatsAppMedia error:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function upsertWhatsAppCustomer({ supabase, waId, phoneNumberId, fullName }: { supabase: any; waId: string; phoneNumberId: string; fullName: string; }) {
  const { data: existing } = await supabase.from('customers').select('*').eq('whatsapp_wa_id', waId).maybeSingle();
  if (existing) { const { data, error } = await supabase.from('customers').update({ full_name: existing.full_name || fullName, phone: existing.phone || waId, whatsapp_wa_id: waId, whatsapp_phone_number_id: phoneNumberId, source_channel: 'WhatsApp' }).eq('id', existing.id).select().single(); if (error) throw error; return data; }
  const { data, error } = await supabase.from('customers').insert({ full_name: fullName, phone: waId, whatsapp_wa_id: waId, whatsapp_phone_number_id: phoneNumberId, source_channel: 'WhatsApp' }).select().single(); if (error) throw error; return data;
}

async function findOpenSessionForWhatsAppUser({ supabase, waId }: { supabase: any; waId: string; }) {
  const { data, error } = await supabase.from('chat_sessions').select('*').eq('user_id', waId).eq('channel', 'WhatsApp').in('status', ['active', 'waiting', 'idle warning']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) { console.warn('[wa] findOpenSession error:', error.message); return null; } return data;
}

async function findAvailableAgentForSession(supabase: any) {
  const cutoff = new Date(Date.now() - ONLINE_AGENT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: presenceRows, error: presenceError } = await supabase.from('agent_presence').select('agent_id, full_name, email, role, presence_status, agent_status, last_seen_at').eq('presence_status', 'Online').eq('agent_status', 'Available').in('role', SUPPORT_AGENT_ROLES).gte('last_seen_at', cutoff);
  if (presenceError) { console.warn('[wa] presence error:', presenceError.message); return null; }
  const valid = (presenceRows || []).filter((r: any) => isSupportAgentRole(r.role));
  const ids = valid.map((r: any) => r.agent_id).filter(Boolean); if (ids.length === 0) return null;
  const { data: agentRows, error: agentError } = await supabase.from('agents').select('id, full_name, email, role, status').in('id', ids).eq('status', 'Available').in('role', SUPPORT_AGENT_ROLES); if (agentError) throw agentError;
  const supportAgents = (agentRows || []).filter((a: any) => isSupportAgentRole(a.role)); if (supportAgents.length === 0) return null;
  const { data: activeSessions, error: sessionError } = await supabase.from('chat_sessions').select('id, agent_id, assigned_agent_id, status').eq('status', 'active'); if (sessionError) throw sessionError;
  const list = activeSessions || [];
  const withLoad = supportAgents.map((a: any) => { const c = list.filter((s: any) => { const id = s.assigned_agent_id || s.agent_id || null; return id && String(id) === String(a.id); }).length; return { ...a, activeCount: c, isBusy: c >= MAX_ACTIVE_SESSIONS_PER_AGENT }; });
  const eligible = withLoad.filter((a: any) => !a.isBusy && isSupportAgentRole(a.role)); if (eligible.length === 0) return null;
  const lowest = Math.min(...eligible.map((a: any) => a.activeCount)); const least = eligible.filter((a: any) => a.activeCount === lowest);
  return least[Math.floor(Math.random() * least.length)] || null;
}

async function sendWhatsAppText({ whatsappToken, phoneNumberId, recipientWaId, text }: { whatsappToken: string; phoneNumberId: string; recipientWaId: string; text: string; }) {
  if (!phoneNumberId) { console.warn('[wa] cannot send: missing phone_number_id'); return null; }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipientWaId, type: 'text', text: { preview_url: false, body: text } }) });
  const result = await res.json();
  if (!res.ok || result?.error) { console.error('[wa] outbound send failed:', JSON.stringify(result?.error || result)); return null; }
  return result;
}
