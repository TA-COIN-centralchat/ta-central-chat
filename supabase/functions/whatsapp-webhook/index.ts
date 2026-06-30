import { createClient } from 'npm:@supabase/supabase-js@2';

// Inbound webhook for the WhatsApp Cloud API. Mirrors the Facebook bot flow:
// a new customer gets a predefined menu (Connect to Agent / FAQ); connecting
// walks them through email -> issue type -> description -> confirm, then a
// chat_sessions row is created and auto-assigned to an online support agent.
// Once connected, text + media are appended to the session. Bot state lives in
// whatsapp_bot_states (keyed by wa_id). Uses WhatsApp interactive buttons/lists.

const GRAPH_API_VERSION = 'v21.0';
const SESSION_DURATION_MINUTES = 20;
const MAX_ACTIVE_SESSIONS_PER_AGENT = 5;
const ONLINE_AGENT_WINDOW_MINUTES = 2;
const ATTACHMENT_BUCKET = 'attachments';
const VOICE_BUCKET = 'voice-messages';
const SUPPORT_AGENT_ROLES = ['Customer Service Agent', 'Customer Support Agent'];

// WhatsApp interactive lists allow at most 10 rows, so the issue types are
// trimmed to 10 (the two P2P entries are merged).
const ISSUE_TYPES = [
  { label: 'Account Issue', value: 'Account Issue' },
  { label: 'General Enquiry', value: 'General Enquiry' },
  { label: 'KYC / Verification', value: 'KYC / Verification Issue' },
  { label: 'Login Issue', value: 'Login Issue' },
  { label: 'OTP Issue', value: 'OTP issue' },
  { label: 'P2P Dispute / Issue', value: 'P2P Issue' },
  { label: 'Technical Support', value: 'Technical Support' },
  { label: 'Transaction Issue', value: 'Transaction Issue' },
  { label: 'Voucher / Coupon', value: 'Voucher / Coupon Issue' },
  { label: 'Withdrawal Issue', value: 'Withdrawal Issue' },
];

const FAQ_ITEMS = [
  { key: 'FAQ_ACCOUNT', label: 'Account Help', text: 'Account Help:\n\nIf you have an account issue, please prepare your registered email and explain the problem you are experiencing.' },
  { key: 'FAQ_TRANSACTION', label: 'Transaction Help', text: 'Transaction Help:\n\nFor deposit, withdrawal, transfer, P2P, voucher, or coupon issues, please prepare your transaction ID if you have one.' },
  { key: 'FAQ_KYC', label: 'KYC / Verification', text: 'KYC / Verification:\n\nPlease make sure your document is clear, valid, and matches the information registered on your account.' },
];

const PLACEHOLDER_BY_KIND: Record<string, string> = { voice: '[Voice message]', audio: '[Audio]', image: '[Image]', video: '[Video]', document: '[Attachment]' };

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-hub-signature-256', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const textResponse = (b: string, s = 200) => new Response(b, { status: s, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
const jsonResponse = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const getExpiryIso = () => new Date(Date.now() + SESSION_DURATION_MINUTES * 60 * 1000).toISOString();
const normalizeRole = (r: unknown) => String(r || '').trim().toLowerCase();
const isSupportAgentRole = (r: unknown) => { const n = normalizeRole(r); return n === 'customer service agent' || n === 'customer support agent'; };
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
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
        if (change.field !== 'messages') continue;
        const value = change.value || {};
        const phoneNumberId = String(value.metadata?.phone_number_id || '');
        const contacts = value.contacts || [];
        for (const message of value.messages || []) {
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

async function handleWhatsAppMessage({ supabase, whatsappToken, phoneNumberId, contacts, message }: any) {
  const waId = String(message.from || contacts?.[0]?.wa_id || '').trim();
  if (!waId) return;
  const profileName = contacts?.find((c: any) => String(c.wa_id) === waId)?.profile?.name || contacts?.[0]?.profile?.name || 'WhatsApp Customer';
  const ctx = { supabase, whatsappToken, phoneNumberId, waId };
  const state = await getOrCreateWhatsAppState({ supabase, waId, phoneNumberId, fullName: profileName });

  const interactivePayload = message.type === 'interactive'
    ? (message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || null)
    : null;
  if (interactivePayload) { await handleActionPayload({ ...ctx, state, payload: String(interactivePayload) }); return; }

  const text = message.type === 'text' ? String(message.text?.body || '').trim()
    : message.type === 'button' ? String(message.button?.text || '').trim() : '';
  const norm = text.toLowerCase();

  if (norm === 'menu' || norm === '/menu' || norm === 'start' || norm === '/start') {
    await resetToMenu({ ...ctx, state, welcome: true });
    return;
  }

  if (state.state === 'awaiting_email') {
    if (!isValidEmail(text)) {
      await waSendText(ctx, 'Please enter a valid email address.\n\nExample: customer@email.com\n\nEmail is required before we connect you to an agent.');
      return;
    }
    const updated = await updateWhatsAppState(supabase, waId, { state: 'awaiting_issue_type', email: text.toLowerCase(), issue_type: null, issue_description: null, current_session_id: null });
    await upsertWhatsAppCustomer({ supabase, waId, phoneNumberId, fullName: updated.full_name || profileName, email: updated.email });
    await showIssueTypeList(ctx);
    return;
  }
  if (state.state === 'awaiting_issue_type') { await showIssueTypeList(ctx); return; }
  if (state.state === 'awaiting_issue_description') {
    if (text.length < 3) { await waSendText(ctx, 'Please describe your issue a little more clearly.\n\nExample: I cannot withdraw because my transaction is stuck.'); return; }
    const updated = await updateWhatsAppState(supabase, waId, { state: 'awaiting_confirmation', issue_description: text });
    await showCustomerSummary(ctx, updated);
    return;
  }
  if (state.state === 'awaiting_confirmation') { await showCustomerSummary(ctx, state); return; }
  if (state.state === 'connected_to_agent') { await handleConnectedMessage({ ...ctx, state, message, text }); return; }

  await showMainMenu({ ...ctx, state, welcome: true });
}

async function handleActionPayload({ supabase, whatsappToken, phoneNumberId, waId, state, payload }: any) {
  const ctx = { supabase, whatsappToken, phoneNumberId, waId };
  if (payload === 'GET_STARTED' || payload === 'BACK_TO_MENU') { await resetToMenu({ ...ctx, state, welcome: payload === 'GET_STARTED' }); return; }
  if (payload === 'CONNECT_AGENT') { await startConnectToAgentFlow(ctx); return; }
  if (payload === 'FAQ_HELP') { await showFaqMenu(ctx); return; }
  if (payload.startsWith('FAQ_')) {
    const faq = FAQ_ITEMS.find((i) => i.key === payload);
    await waSendButtons(ctx, faq?.text || 'FAQ item not found.', [ { id: 'CONNECT_AGENT', title: 'Connect to Agent' }, { id: 'FAQ_HELP', title: 'FAQ / Help' }, { id: 'BACK_TO_MENU', title: 'Main Menu' } ]);
    return;
  }
  if (payload === 'EDIT_REQUEST') { await startConnectToAgentFlow(ctx); return; }
  if (payload === 'CANCEL_FLOW') { await resetToMenu({ ...ctx, state, welcome: false }); return; }
  if (payload.startsWith('ISSUE_TYPE::')) {
    const issueType = payload.replace('ISSUE_TYPE::', '');
    await updateWhatsAppState(supabase, waId, { state: 'awaiting_issue_description', issue_type: issueType, issue_description: null, current_session_id: null });
    await waSendText(ctx, `You selected: ${issueType}\n\nPlease describe your issue clearly.\n\nExample: I cannot withdraw because my transaction is stuck.`);
    return;
  }
  if (payload === 'CONFIRM_CONNECT_AGENT') {
    const fresh = await getWhatsAppState(supabase, waId);
    await createWhatsAppLiveChatSession({ ...ctx, state: fresh || state });
    return;
  }
  await showMainMenu({ ...ctx, state, welcome: false });
}

async function resetToMenu({ supabase, whatsappToken, phoneNumberId, waId, state, welcome }: any) {
  const reset = await updateWhatsAppState(supabase, waId, { state: 'menu', current_session_id: null, issue_type: null, issue_description: null });
  await showMainMenu({ supabase, whatsappToken, phoneNumberId, waId, state: reset || state, welcome });
}

async function showMainMenu({ supabase, whatsappToken, phoneNumberId, waId, state, welcome }: any) {
  await updateWhatsAppState(supabase, waId, { state: 'menu' });
  const greeting = welcome ? 'Welcome to T.A Coin Support 👋\n\n' : '';
  const name = state?.full_name ? `, ${state.full_name}` : '';
  await waSendButtons({ supabase, whatsappToken, phoneNumberId, waId }, `${greeting}How can we help you today${name}?\n\nPlease choose an option below.`, [ { id: 'CONNECT_AGENT', title: 'Connect to Agent' }, { id: 'FAQ_HELP', title: 'FAQ / Help' } ]);
}

async function startConnectToAgentFlow(ctx: any) {
  await updateWhatsAppState(ctx.supabase, ctx.waId, { state: 'awaiting_email', current_session_id: null, email: null, issue_type: null, issue_description: null });
  await waSendText(ctx, 'Please enter your email address.\n\nExample: customer@email.com\n\nEmail is required before we connect you to an agent.');
}

async function showFaqMenu(ctx: any) {
  const rows = [ ...FAQ_ITEMS.map((i) => ({ id: i.key, title: i.label })), { id: 'CONNECT_AGENT', title: 'Connect to Agent' }, { id: 'BACK_TO_MENU', title: 'Main Menu' } ];
  await waSendList(ctx, 'FAQ / Help\n\nPlease choose a topic below. If you still need help, you can connect to an agent.', 'View topics', rows, 'FAQ / Help');
}

async function showIssueTypeList(ctx: any) {
  const rows = ISSUE_TYPES.map((i) => ({ id: `ISSUE_TYPE::${i.value}`, title: i.label }));
  await waSendList(ctx, 'Thank you. Please choose your issue type:', 'Select issue', rows, 'Issue types');
}

async function showCustomerSummary(ctx: any, state: any) {
  const summary = 'Please confirm your request before connecting to an agent:\n\n' +
    `Name: ${state.full_name || '-'}\n` +
    `Email: ${state.email || '-'}\n` +
    `Issue Type: ${state.issue_type || '-'}\n` +
    `Issue Description: ${state.issue_description || '-'}\n\n` +
    'If everything is correct, choose “Confirm & Connect”.';
  await waSendButtons(ctx, summary, [ { id: 'CONFIRM_CONNECT_AGENT', title: 'Confirm & Connect' }, { id: 'EDIT_REQUEST', title: 'Edit' }, { id: 'CANCEL_FLOW', title: 'Cancel' } ]);
}

async function createWhatsAppLiveChatSession({ supabase, whatsappToken, phoneNumberId, waId, state }: any) {
  const ctx = { supabase, whatsappToken, phoneNumberId, waId };
  if (!state?.email || !isValidEmail(state.email)) { await updateWhatsAppState(supabase, waId, { state: 'awaiting_email' }); await waSendText(ctx, 'Please enter your email address to continue.'); return; }
  if (!state.issue_type || !state.issue_description) { await updateWhatsAppState(supabase, waId, { state: 'awaiting_issue_type' }); await showIssueTypeList(ctx); return; }

  const existing = await findOpenSessionForWhatsAppUser({ supabase, waId });
  if (existing) {
    await updateWhatsAppState(supabase, waId, { state: 'connected_to_agent', current_session_id: existing.id });
    await waSendText(ctx, 'You already have an active support session. Please continue typing your message here.');
    return;
  }

  const customer = await upsertWhatsAppCustomer({ supabase, waId, phoneNumberId, fullName: state.full_name || 'WhatsApp Customer', email: state.email });
  let selectedAgent = await findAvailableAgentForSession(supabase);
  if (selectedAgent && !isSupportAgentRole(selectedAgent.role)) selectedAgent = null;
  const assignedAgentName = selectedAgent ? selectedAgent.full_name || 'Support Agent' : null;
  const sessionExpiry = selectedAgent ? getExpiryIso() : null;
  const nowIso = new Date().toISOString();

  const sessionMetadata = { source: 'whatsapp', channel: 'WhatsApp', whatsappWaId: waId, whatsappPhoneNumberId: phoneNumberId, customerId: customer.id, customerName: state.full_name || 'WhatsApp Customer', phone: waId, email: state.email, issueType: state.issue_type, issueDescription: state.issue_description, assignedAgentName, assignedAgentEmail: selectedAgent?.email || null, assignedAgentRole: selectedAgent?.role || null, expiresAt: sessionExpiry, warningSentAt: null, lastActivityAt: nowIso };

  const { data: session, error: sessionError } = await supabase.from('chat_sessions').insert({ session_number: `WA-${Date.now()}`, user_id: waId, customer_id: customer.id, status: selectedAgent ? 'active' : 'waiting', agent_id: selectedAgent?.id ? String(selectedAgent.id) : null, assigned_agent_id: selectedAgent?.id || null, assigned_agent_name: assignedAgentName, channel: 'WhatsApp', last_message: state.issue_description, expires_at: sessionExpiry, warning_sent_at: null, metadata: sessionMetadata }).select().single();
  if (sessionError) throw sessionError;

  await supabase.from('chat_messages').insert({ session_id: session.id, sender_role: 'user', sender_id: waId, content: state.issue_description, metadata: { source: 'whatsapp', whatsappWaId: waId, whatsappPhoneNumberId: phoneNumberId, issueType: state.issue_type } });
  await supabase.from('chat_messages').insert({ session_id: session.id, sender_role: 'system', sender_id: 'system', content: `Issue Type: ${state.issue_type || '-'}`, metadata: { source: 'whatsapp', type: 'issue_context' } });

  if (selectedAgent) {
    await supabase.from('chat_messages').insert({ session_id: session.id, sender_role: 'system', sender_id: 'system', content: 'You are now connected with our support team.', metadata: { source: 'whatsapp', type: 'auto_assigned', agentId: selectedAgent.id, agentName: selectedAgent.full_name, agentRole: selectedAgent.role } });
    await waSendText(ctx, 'Thank you. You are now connected with our support team. Please wait for their reply.');
  } else {
    await supabase.from('chat_messages').insert({ session_id: session.id, sender_role: 'system', sender_id: 'system', content: 'All support agents are currently busy or unavailable. Your chat has been added to the waiting queue.', metadata: { source: 'whatsapp', type: 'waiting_queue' } });
    await waSendText(ctx, 'Thank you. All support agents are currently busy or unavailable, so your chat has been added to the waiting queue. Our team will reply as soon as possible.');
  }

  await updateWhatsAppState(supabase, waId, { state: 'connected_to_agent', current_session_id: session.id });
}

async function handleConnectedMessage({ supabase, whatsappToken, phoneNumberId, waId, state, message, text }: any) {
  const ctx = { supabase, whatsappToken, phoneNumberId, waId };
  if (!state.current_session_id) { await resetToMenu({ ...ctx, state, welcome: false }); return; }
  const { data: session } = await supabase.from('chat_sessions').select('*').eq('id', state.current_session_id).maybeSingle();
  const status = String(session?.status || '').toLowerCase();
  if (!session || status === 'closed' || status === 'ended') {
    await waSendText(ctx, 'Your previous support session has ended. Send "menu" to start a new request.');
    await resetToMenu({ ...ctx, state, welcome: false });
    return;
  }

  const whatsappMessageId = String(message.id || '');
  if (whatsappMessageId) {
    const { data: dup } = await supabase.from('chat_messages').select('id').contains('metadata', { whatsappMessageId }).limit(1).maybeSingle();
    if (dup) return;
  }

  const media = extractMediaInfo(message);
  const content = (media?.caption || text || (media ? PLACEHOLDER_BY_KIND[media.kind] : '') || '').trim() || '[Unsupported message]';
  const attachment = media?.mediaId ? await downloadAndStoreWhatsAppMedia({ supabase, token: whatsappToken, media, sessionId: session.id }) : null;

  await supabase.from('chat_messages').insert({ session_id: session.id, sender_role: 'user', sender_id: waId, content, attachment_url: attachment?.url || null, metadata: { source: 'whatsapp', whatsappWaId: waId, whatsappPhoneNumberId: phoneNumberId, whatsappMessageId, ...(attachment ? { attachment_url: attachment.url, bucket: attachment.bucket, storagePath: attachment.storagePath, mimeType: attachment.mimeType, fileName: attachment.fileName, kind: attachment.kind, ...(attachment.durationSec != null ? { duration: attachment.durationSec } : {}) } : {}) } });

  const metadata = session.metadata && typeof session.metadata === 'object' ? session.metadata : {};
  const nowIso = new Date().toISOString();
  const newExpiry = getExpiryIso();
  await supabase.from('chat_sessions').update({ last_message: content, last_customer_message_at: nowIso, updated_at: nowIso, expires_at: newExpiry, warning_sent_at: null, metadata: { ...metadata, expiresAt: newExpiry, warningSentAt: null, lastActivityAt: nowIso } }).eq('id', session.id);
}

function extractMediaInfo(message: any): any {
  const type = String(message.type || '');
  const ts = Date.now();
  if (type === 'image' && message.image?.id) return { mediaId: message.image.id, kind: 'image', mimeType: message.image.mime_type || 'image/jpeg', fileName: `image_${ts}.jpg`, caption: String(message.image.caption || '').trim(), durationSec: null };
  if (type === 'sticker' && message.sticker?.id) return { mediaId: message.sticker.id, kind: 'image', mimeType: message.sticker.mime_type || 'image/webp', fileName: `sticker_${ts}.webp`, caption: '', durationSec: null };
  if (type === 'audio' && message.audio?.id) { const v = Boolean(message.audio.voice); const m = message.audio.mime_type || 'audio/ogg'; const ext = m.includes('ogg') ? 'oga' : (m.split('/')[1] || 'mp3').split(';')[0].replace('mpeg', 'mp3'); return { mediaId: message.audio.id, kind: v ? 'voice' : 'audio', mimeType: m, fileName: `${v ? 'voice' : 'audio'}_${ts}.${ext}`, caption: '', durationSec: null }; }
  if (type === 'video' && message.video?.id) return { mediaId: message.video.id, kind: 'video', mimeType: message.video.mime_type || 'video/mp4', fileName: `video_${ts}.mp4`, caption: String(message.video.caption || '').trim(), durationSec: null };
  if (type === 'document' && message.document?.id) return { mediaId: message.document.id, kind: 'document', mimeType: message.document.mime_type || 'application/octet-stream', fileName: message.document.filename || `file_${ts}`, caption: String(message.document.caption || '').trim(), durationSec: null };
  return null;
}

async function downloadAndStoreWhatsAppMedia({ supabase, token, media, sessionId }: any) {
  try {
    const bucket = media.kind === 'voice' || media.kind === 'audio' ? VOICE_BUCKET : ATTACHMENT_BUCKET;
    const storagePath = `whatsapp/${sessionId}/${media.fileName}`;
    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(media.mediaId)}`, { headers: { Authorization: `Bearer ${token}` } });
    const metaData = await metaRes.json();
    if (!metaRes.ok || !metaData?.url) { console.error('[wa] media lookup failed:', JSON.stringify(metaData?.error || metaData)); return null; }
    const binRes = await fetch(metaData.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!binRes.ok) { console.error('[wa] media download failed:', binRes.status); return null; }
    const blob = await binRes.blob();
    const resolvedMime = metaData.mime_type || media.mimeType || blob.type || 'application/octet-stream';
    const { error: upErr } = await supabase.storage.from(bucket).upload(storagePath, blob, { contentType: resolvedMime, upsert: false });
    if (upErr) { console.error(`[wa] storage upload error (${bucket}):`, upErr.message); return null; }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return { url: pub?.publicUrl || null, bucket, storagePath, mimeType: resolvedMime, fileName: media.fileName, kind: media.kind, durationSec: media.durationSec ?? null };
  } catch (e) { console.error('[wa] media store error:', e instanceof Error ? e.message : e); return null; }
}

/* ===== bot state ===== */
async function getWhatsAppState(supabase: any, waId: string) {
  const { data, error } = await supabase.from('whatsapp_bot_states').select('*').eq('whatsapp_wa_id', waId).maybeSingle();
  if (error) throw error;
  return data;
}
async function getOrCreateWhatsAppState({ supabase, waId, phoneNumberId, fullName }: any) {
  const existing = await getWhatsAppState(supabase, waId);
  if (existing) {
    const { data, error } = await supabase.from('whatsapp_bot_states').update({ whatsapp_phone_number_id: phoneNumberId, full_name: existing.full_name || fullName, updated_at: new Date().toISOString() }).eq('whatsapp_wa_id', waId).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('whatsapp_bot_states').insert({ whatsapp_wa_id: waId, whatsapp_phone_number_id: phoneNumberId, full_name: fullName, state: 'menu' }).select().single();
  if (error) throw error;
  return data;
}
async function updateWhatsAppState(supabase: any, waId: string, values: Record<string, unknown>) {
  const { data, error } = await supabase.from('whatsapp_bot_states').update({ ...values, updated_at: new Date().toISOString() }).eq('whatsapp_wa_id', waId).select().single();
  if (error) throw error;
  return data;
}

/* ===== customer ===== */
async function upsertWhatsAppCustomer({ supabase, waId, phoneNumberId, fullName, email }: any) {
  const { data: existing } = await supabase.from('customers').select('*').eq('whatsapp_wa_id', waId).maybeSingle();
  if (existing) {
    const { data, error } = await supabase.from('customers').update({ full_name: existing.full_name || fullName, phone: existing.phone || waId, email: email || existing.email || null, whatsapp_wa_id: waId, whatsapp_phone_number_id: phoneNumberId, source_channel: 'WhatsApp' }).eq('id', existing.id).select().single();
    if (error) throw error; return data;
  }
  const { data, error } = await supabase.from('customers').insert({ full_name: fullName, phone: waId, email: email || null, whatsapp_wa_id: waId, whatsapp_phone_number_id: phoneNumberId, source_channel: 'WhatsApp' }).select().single();
  if (error) throw error; return data;
}

async function findOpenSessionForWhatsAppUser({ supabase, waId }: any) {
  const { data, error } = await supabase.from('chat_sessions').select('*').eq('user_id', waId).eq('channel', 'WhatsApp').in('status', ['active', 'waiting', 'idle warning']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) { console.warn('[wa] findOpenSession error:', error.message); return null; }
  return data;
}

/* ===== auto assignment (random among eligible online support agents) ===== */
async function findAvailableAgentForSession(supabase: any) {
  const cutoff = new Date(Date.now() - ONLINE_AGENT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: presenceRows, error: presenceError } = await supabase.from('agent_presence').select('agent_id, full_name, email, role, presence_status, agent_status, last_seen_at').eq('presence_status', 'Online').eq('agent_status', 'Available').in('role', SUPPORT_AGENT_ROLES).gte('last_seen_at', cutoff);
  if (presenceError) { console.warn('[wa] presence error:', presenceError.message); return null; }
  const ids = (presenceRows || []).filter((r: any) => isSupportAgentRole(r.role)).map((r: any) => r.agent_id).filter(Boolean);
  if (ids.length === 0) return null;
  const { data: agentRows, error: agentError } = await supabase.from('agents').select('id, full_name, email, role, status').in('id', ids).eq('status', 'Available').in('role', SUPPORT_AGENT_ROLES);
  if (agentError) throw agentError;
  const supportAgents = (agentRows || []).filter((a: any) => isSupportAgentRole(a.role));
  if (supportAgents.length === 0) return null;
  const { data: activeSessions, error: sessionError } = await supabase.from('chat_sessions').select('id, agent_id, assigned_agent_id, status').eq('status', 'active');
  if (sessionError) throw sessionError;
  const list = activeSessions || [];
  const eligible = supportAgents.map((a: any) => { const c = list.filter((s: any) => { const id = s.assigned_agent_id || s.agent_id || null; return id && String(id) === String(a.id); }).length; return { ...a, isBusy: c >= MAX_ACTIVE_SESSIONS_PER_AGENT }; }).filter((a: any) => !a.isBusy && isSupportAgentRole(a.role));
  if (eligible.length === 0) return null;
  const selected = eligible[Math.floor(Math.random() * eligible.length)] || null;
  if (!selected || !isSupportAgentRole(selected.role)) return null;
  return selected;
}

/* ===== WhatsApp Cloud API senders ===== */
async function waSend(ctx: any, interactiveOrText: any) {
  const { whatsappToken, phoneNumberId, waId } = ctx;
  if (!phoneNumberId) { console.warn('[wa] cannot send: missing phone_number_id'); return null; }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: waId, ...interactiveOrText }) });
  const result = await res.json();
  if (!res.ok || result?.error) { console.error('[wa] send failed:', JSON.stringify(result?.error || result)); return null; }
  return result;
}
async function waSendText(ctx: any, text: string) { return waSend(ctx, { type: 'text', text: { preview_url: false, body: text } }); }
async function waSendButtons(ctx: any, bodyText: string, buttons: Array<{ id: string; title: string }>) {
  return waSend(ctx, { type: 'interactive', interactive: { type: 'button', body: { text: bodyText.slice(0, 1024) }, action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) } })) } } });
}
async function waSendList(ctx: any, bodyText: string, buttonLabel: string, rows: Array<{ id: string; title: string; description?: string }>, sectionTitle: string) {
  return waSend(ctx, { type: 'interactive', interactive: { type: 'list', body: { text: bodyText.slice(0, 1024) }, action: { button: buttonLabel.slice(0, 20), sections: [ { title: sectionTitle.slice(0, 24), rows: rows.slice(0, 10).map((r) => ({ id: r.id.slice(0, 200), title: r.title.slice(0, 24), ...(r.description ? { description: r.description.slice(0, 72) } : {}) })) } ] } } });
}
