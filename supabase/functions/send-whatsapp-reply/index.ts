import { createClient } from 'npm:@supabase/supabase-js@2';

// Outbound relay for the WhatsApp channel. The dashboard inserts the agent
// reply into chat_messages (via sendSessionReply) and then invokes this
// function, which delivers the same text to the customer through the WhatsApp
// Cloud API. Mirrors send-facebook-reply; the only real differences are the
// Graph API request body (messaging_product: 'whatsapp') and the recipient
// being a wa_id (phone number) rather than a Page-scoped id.
//
// NOTE: WhatsApp only allows free-form text inside the 24-hour customer-service
// window (i.e. within 24h of the customer's last inbound message). Outside it,
// Meta rejects the send and only approved templates are allowed — that error is
// surfaced verbatim so the agent understands why delivery failed.

const GRAPH_API_VERSION = 'v21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const getObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' ? (value as Record<string, any>) : {};

const cleanText = (value: unknown) => String(value || '').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const whatsappToken = Deno.env.get('WHATSAPP_TOKEN');
    const defaultPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL.');
    if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');
    if (!whatsappToken) throw new Error('Missing WHATSAPP_TOKEN.');

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();

    const sessionId = cleanText(body?.sessionId || body?.session_id);
    const text = cleanText(body?.text || body?.content);
    const senderId = cleanText(body?.senderId || body?.sender_id || 'agent');
    const senderName = cleanText(
      body?.senderName || body?.sender_name || 'Support Agent',
    );

    if (!sessionId) {
      return jsonResponse({ ok: false, error: 'Session ID is required.' }, 400);
    }

    if (!text) {
      return jsonResponse(
        { ok: false, error: 'Message text is required.' },
        400,
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select(
        `
          id,
          user_id,
          customer_id,
          channel,
          status,
          metadata,
          customers (
            id,
            email,
            whatsapp_wa_id,
            whatsapp_phone_number_id
          )
        `,
      )
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) throw sessionError;

    if (!session) {
      return jsonResponse({ ok: false, error: 'Session not found.' }, 404);
    }

    const normalizedChannel = cleanText(session.channel).toLowerCase();

    if (normalizedChannel !== 'whatsapp') {
      return jsonResponse(
        { ok: false, error: 'This session is not a WhatsApp session.' },
        400,
      );
    }

    const normalizedStatus = cleanText(session.status).toLowerCase();

    if (normalizedStatus === 'closed' || normalizedStatus === 'ended') {
      return jsonResponse(
        { ok: false, error: 'This support session has already ended.' },
        409,
      );
    }

    const metadata = getObject(session.metadata);
    const customer = Array.isArray(session.customers)
      ? session.customers[0]
      : session.customers;

    const recipientWaId = cleanText(
      metadata.whatsappWaId ||
        metadata.whatsapp_wa_id ||
        customer?.whatsapp_wa_id ||
        session.user_id,
    );

    const phoneNumberId = cleanText(
      metadata.whatsappPhoneNumberId ||
        metadata.whatsapp_phone_number_id ||
        customer?.whatsapp_phone_number_id ||
        defaultPhoneNumberId,
    );

    if (!recipientWaId) {
      return jsonResponse(
        {
          ok: false,
          error: 'WhatsApp recipient (wa_id) was not found for this session.',
        },
        400,
      );
    }

    if (!phoneNumberId) {
      return jsonResponse(
        {
          ok: false,
          error:
            'WhatsApp phone number id was not found for this session (set WHATSAPP_PHONE_NUMBER_ID).',
        },
        400,
      );
    }

    const whatsappResult = await sendWhatsAppText({
      whatsappToken,
      phoneNumberId,
      recipientWaId,
      text,
    });

    const whatsappMessageId =
      whatsappResult?.messages?.[0]?.id || null;

    const nowIso = new Date().toISOString();

    const { data: savedMessage, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: session.id,
        sender_role: 'agent',
        sender_id: senderId,
        content: text,
        metadata: {
          source: 'whatsapp',
          direction: 'outbound',
          senderName,
          whatsappWaId: recipientWaId,
          whatsappPhoneNumberId: phoneNumberId,
          whatsappMessageId,
        },
      })
      .select()
      .single();

    if (messageError) {
      console.error(
        'WhatsApp message was delivered, but saving it failed:',
        messageError,
      );

      return jsonResponse(
        {
          ok: true,
          delivered: true,
          saved: false,
          warning:
            'Message was delivered to WhatsApp, but it could not be saved in chat_messages.',
          whatsappMessageId,
        },
        200,
      );
    }

    const { error: updateSessionError } = await supabase
      .from('chat_sessions')
      .update({
        last_message: text,
        last_agent_message_at: nowIso,
        updated_at: nowIso,
        metadata: {
          ...metadata,
          lastActivityAt: nowIso,
          lastAgentMessageAt: nowIso,
        },
      })
      .eq('id', session.id);

    if (updateSessionError) {
      console.error(
        'WhatsApp reply was delivered and saved, but session update failed:',
        updateSessionError,
      );
    }

    return jsonResponse(
      {
        ok: true,
        delivered: true,
        saved: true,
        message: savedMessage,
        whatsappMessageId,
      },
      200,
    );
  } catch (error) {
    console.error('send-whatsapp-reply error:', error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : 'WhatsApp reply failed.',
      },
      500,
    );
  }
});

async function sendWhatsAppText({
  whatsappToken,
  phoneNumberId,
  recipientWaId,
  text,
}: {
  whatsappToken: string;
  phoneNumberId: string;
  recipientWaId: string;
  text: string;
}) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(
      phoneNumberId,
    )}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientWaId,
        type: 'text',
        text: { preview_url: false, body: text },
      }),
    },
  );

  const result = await response.json();

  if (!response.ok || result?.error) {
    console.error('WhatsApp message send failed:', result);
    throw new Error(
      result?.error?.message || 'WhatsApp message send failed.',
    );
  }

  return result;
}
