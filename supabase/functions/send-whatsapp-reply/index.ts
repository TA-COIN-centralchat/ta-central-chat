import { createClient } from 'npm:@supabase/supabase-js@2';

// Outbound relay for the WhatsApp channel. Relay-only: the dashboard already
// inserts the agent's chat_messages row (text or media) BEFORE calling this, so
// this function only delivers to the customer via the WhatsApp Cloud API and
// does NOT write to the DB.
//
// Supports three payload shapes:
//   1. Text:  { sessionId, text }
//   2. Media from Supabase Storage (preferred, mirrors send-telegram-reply):
//        { sessionId, bucket, storagePath, fileName, mimeType, kind, caption }
//      -> downloads the file with the service role, uploads it to the WhatsApp
//         /media endpoint, then sends it by media id.
//   3. Media from a public/signed URL (fallback): { sessionId, mediaUrl, mimeType, kind, caption, fileName }
//
// WhatsApp message type is derived from the MIME type / kind: image, audio
// (voice notes are audio/ogg+opus mono), video, or document. The sender
// phone-number-id comes from WHATSAPP_PHONE_NUMBER_ID.
//
// NOTE: WhatsApp only allows free-form sends inside the 24h customer-service
// window; outside it Meta rejects the send and that error is surfaced.

const GRAPH_API_VERSION = 'v21.0';
const DEFAULT_VOICE_BUCKET = 'voice-messages';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const getObject = (v: unknown): Record<string, any> => (v && typeof v === 'object' ? (v as Record<string, any>) : {});
const cleanText = (v: unknown) => String(v || '').trim();

// Decide the WhatsApp message type from the MIME type first, then the kind hint.
const resolveWhatsAppType = (mime: string, kind: string): 'image' | 'audio' | 'video' | 'document' => {
  const m = mime.toLowerCase();
  const k = kind.toLowerCase();
  if (m.startsWith('image/') || ['image', 'photo', 'picture', 'img', 'sticker'].some((t) => k.includes(t))) return 'image';
  if (m.startsWith('audio/') || ['voice', 'audio'].some((t) => k.includes(t))) return 'audio';
  if (m.startsWith('video/') || k.includes('video')) return 'video';
  return 'document';
};

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
    const bucket = cleanText(body?.bucket) || DEFAULT_VOICE_BUCKET;
    const storagePath = cleanText(body?.storagePath || body?.storage_path);
    const mediaUrl = cleanText(body?.mediaUrl || body?.media_url || body?.voiceUrl || body?.imageUrl);
    const fileName = cleanText(body?.fileName || body?.file_name);
    const bodyMime = cleanText(body?.mimeType || body?.mime_type);
    const kind = cleanText(body?.kind);
    const caption = cleanText(body?.caption);

    if (!sessionId) return jsonResponse({ ok: false, error: 'Session ID is required.' }, 400);

    const hasMedia = Boolean(storagePath || mediaUrl);
    if (!text && !hasMedia) return jsonResponse({ ok: false, error: 'Either text or media is required.' }, 400);

    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select(`id, user_id, channel, status, metadata, customers ( whatsapp_wa_id, whatsapp_phone_number_id )`)
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) return jsonResponse({ ok: false, error: 'Session not found.' }, 404);
    if (cleanText(session.channel).toLowerCase() !== 'whatsapp') return jsonResponse({ ok: false, error: 'This session is not a WhatsApp session.' }, 400);

    const status = cleanText(session.status).toLowerCase();
    if (status === 'closed' || status === 'ended') return jsonResponse({ ok: false, error: 'This support session has already ended.' }, 409);

    const metadata = getObject(session.metadata);
    const customer = Array.isArray(session.customers) ? session.customers[0] : session.customers;
    const recipientWaId = cleanText(metadata.whatsappWaId || metadata.whatsapp_wa_id || customer?.whatsapp_wa_id || session.user_id);
    const phoneNumberId = cleanText(envPhoneNumberId || metadata.whatsappPhoneNumberId || metadata.whatsapp_phone_number_id || customer?.whatsapp_phone_number_id);

    if (!recipientWaId) return jsonResponse({ ok: false, error: 'WhatsApp recipient (wa_id) was not found for this session.' }, 400);
    if (!phoneNumberId) return jsonResponse({ ok: false, error: 'WhatsApp phone number id is not configured (set WHATSAPP_PHONE_NUMBER_ID).' }, 400);

    const base = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}`;
    const authHeader = { Authorization: `Bearer ${whatsappToken}` };

    /* ---------- Media reply ---------- */
    if (hasMedia) {
      // 1. Get the file bytes (download from Storage with the service role, or
      //    fall back to fetching a provided URL).
      let blob: Blob;
      if (storagePath) {
        const { data: file, error: dlErr } = await supabase.storage.from(bucket).download(storagePath);
        if (dlErr || !file) {
          console.error('[wa] storage download failed:', { bucket, storagePath, message: dlErr?.message });
          return jsonResponse({ ok: false, error: dlErr?.message || 'Failed to download media from Storage.' }, 502);
        }
        blob = file;
      } else {
        const r = await fetch(mediaUrl);
        if (!r.ok) return jsonResponse({ ok: false, error: `Failed to fetch media URL: ${r.status}` }, 502);
        blob = await r.blob();
      }

      const mime = bodyMime || blob.type || 'application/octet-stream';
      const messageType = resolveWhatsAppType(mime, kind);
      const safeName = fileName || `${messageType}_${Date.now()}`;

      // 2. Upload to the WhatsApp /media endpoint -> media id.
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('type', mime);
      form.append('file', new File([blob], safeName, { type: mime }));

      const upRes = await fetch(`${base}/media`, { method: 'POST', headers: authHeader, body: form });
      const upData = await upRes.json();
      if (!upRes.ok || !upData?.id) {
        console.error('[wa] media upload failed:', JSON.stringify(upData?.error || upData));
        return jsonResponse({ ok: false, error: upData?.error?.message || 'WhatsApp media upload failed.' }, 502);
      }
      const mediaId = upData.id;

      // 3. Send the media message by id. Only image/video/document accept a
      //    caption; document also accepts a filename.
      const mediaObject: Record<string, unknown> = { id: mediaId };
      if (caption && messageType !== 'audio') mediaObject.caption = caption;
      if (messageType === 'document' && safeName) mediaObject.filename = safeName;

      const sendRes = await fetch(`${base}/messages`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipientWaId, type: messageType, [messageType]: mediaObject }),
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok || sendData?.error) {
        console.error('[wa] media send failed:', JSON.stringify(sendData?.error || sendData));
        return jsonResponse({ ok: false, error: sendData?.error?.message || 'WhatsApp media send failed.' }, 502);
      }

      return jsonResponse({ ok: true, delivered: true, type: messageType, whatsappMessageId: sendData?.messages?.[0]?.id || null }, 200);
    }

    /* ---------- Text reply ---------- */
    const sendRes = await fetch(`${base}/messages`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipientWaId, type: 'text', text: { preview_url: false, body: text } }),
    });
    const sendData = await sendRes.json();
    if (!sendRes.ok || sendData?.error) {
      console.error('[wa] text send failed:', JSON.stringify(sendData?.error || sendData));
      return jsonResponse({ ok: false, error: sendData?.error?.message || 'WhatsApp message send failed.' }, 502);
    }
    return jsonResponse({ ok: true, delivered: true, type: 'text', whatsappMessageId: sendData?.messages?.[0]?.id || null }, 200);
  } catch (error) {
    console.error('[wa] send-whatsapp-reply error:', error instanceof Error ? error.message : error);
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'WhatsApp reply failed.' }, 500);
  }
});
