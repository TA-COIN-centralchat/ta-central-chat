import { createClient } from 'npm:@supabase/supabase-js@2';

// Outbound relay for the WhatsApp channel. The dashboard already inserts the
// agent reply into chat_messages (via sendSessionReply) BEFORE calling this
// function, so this function ONLY delivers the text to the customer through the
// WhatsApp Cloud API — it does not write to the DB (doing so would duplicate the
// agent message). Mirrors the relay-only contract of send-telegram-reply.
//
// The sender phone-number-id is taken from the WHATSAPP_PHONE_NUMBER_ID secret
// (your real business number) first, so replies work even for sessions whose
// stored metadata carried a placeholder id (e.g. Meta's webhook "Test" sample).
//
// NOTE: WhatsApp only allows free-form text inside the 24-hour customer-service
// window. Outside it Meta rejects the send; that error is surfaced verbatim.

const GRAPH_API_VERSION = 'v21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const getObject = (v: unknown): Record<string, any> => (v && typeof v === 'object' ? (v as Record<string, any>) : {});
const cleanText = (v: unknown) => String(v || '').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const whatsappToken = Deno.env.get('WHATSAPP_TOKEN');
    const envPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL.');
    if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');
    if (!whatsappToken) throw new Error('Missing WHATSAPP_TOKEN.');

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const body = await req.json();
    const sessionId = cleanText(body?.sessionId || body?.session_id);
    const text = cleanText(body?.text || body?.content);

    if (!sessionId) return jsonResponse({ ok: false, error: 'Session ID is required.' }, 400);
    if (!text) return jsonResponse({ ok: false, error: 'Message text is required.' }, 400);

    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select(`id, user_id, channel, status, metadata, customers ( whatsapp_wa_id, whatsapp_phone_number_id )`)
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) return jsonResponse({ ok: false, error: 'Session not found.' }, 404);

    if (cleanText(session.channel).toLowerCase() !== 'whatsapp') {
      return jsonResponse({ ok: false, error: 'This session is not a WhatsApp session.' }, 400);
    }

    const status = cleanText(session.status).toLowerCase();
    if (status === 'closed' || status === 'ended') {
      return jsonResponse({ ok: false, error: 'This support session has already ended.' }, 409);
    }

    const metadata = getObject(session.metadata);
    const customer = Array.isArray(session.customers) ? session.customers[0] : session.customers;

    const recipientWaId = cleanText(
      metadata.whatsappWaId || metadata.whatsapp_wa_id || customer?.whatsapp_wa_id || session.user_id,
    );

    // Prefer the real business number from env; fall back to whatever the
    // session recorded. This keeps replies working even if a session stored a
    // placeholder phone-number-id.
    const phoneNumberId = cleanText(
      envPhoneNumberId || metadata.whatsappPhoneNumberId || metadata.whatsapp_phone_number_id || customer?.whatsapp_phone_number_id,
    );

    if (!recipientWaId) return jsonResponse({ ok: false, error: 'WhatsApp recipient (wa_id) was not found for this session.' }, 400);
    if (!phoneNumberId) return jsonResponse({ ok: false, error: 'WhatsApp phone number id is not configured (set WHATSAPP_PHONE_NUMBER_ID).' }, 400);

    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipientWaId, type: 'text', text: { preview_url: false, body: text } }),
    });

    const result = await res.json();
    if (!res.ok || result?.error) {
      console.error('[wa] outbound send failed:', JSON.stringify(result?.error || result));
      return jsonResponse({ ok: false, error: result?.error?.message || 'WhatsApp message send failed.' }, 502);
    }

    return jsonResponse({ ok: true, delivered: true, whatsappMessageId: result?.messages?.[0]?.id || null }, 200);
  } catch (error) {
    console.error('[wa] send-whatsapp-reply error:', error instanceof Error ? error.message : error);
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'WhatsApp reply failed.' }, 500);
  }
});
