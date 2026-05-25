import { supabase } from './supabaseClient';

const mapSession = (session) => ({
  dbId: session.id,
  id: session.session_number,
  customerId: session.customer_id,
  customer: session.customers?.full_name || 'Unknown Customer',
  phone: session.customers?.phone || '',
  telegram: session.customers?.telegram_username || '',
  email: session.customers?.email || '',
  accountId: session.customers?.ta_coin_user_id || '',
  channel: session.channel,
  status: session.status,
  lastMessage: session.last_message || 'No message yet.',
  rating: session.rating,
  ratingComment: session.rating_comment || '',
  endedAt: session.ended_at,
  createdAt: session.created_at,
  time: session.created_at
    ? new Date(session.created_at).toLocaleString()
    : 'N/A',
  linkedTickets: session.tickets || [],
});

export const getSessions = async () => {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      customers (*),
      tickets (*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
    throw error;
  }

  return (data || []).map(mapSession);
};

export const getSessionById = async (sessionId) => {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      customers (*),
      tickets (*)
    `)
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('Error fetching session:', error);
    throw error;
  }

  return mapSession(data);
};

export const getSessionsByChannel = async (channel) => {
  const sessions = await getSessions();
  return sessions.filter((session) => session.channel === channel);
};

export const createSession = async ({
  customerId,
  channel,
  lastMessage = '',
}) => {
  const sessionNumber = `SES-${Date.now()}`;

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      session_number: sessionNumber,
      customer_id: customerId || null,
      channel,
      status: 'Active',
      last_message: lastMessage || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating session:', error);
    throw error;
  }

  await supabase.from('audit_logs').insert({
    user_name: 'System',
    role: 'System',
    action: 'Session Created',
    details: `New ${channel} session created: ${sessionNumber}.`,
  });

  return data;
};

export const createTestSession = async (channel) => {
  const timestamp = Date.now();

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({
      full_name: `Test Customer ${timestamp}`,
      phone: `010${String(timestamp).slice(-6)}`,
      telegram_username:
        channel === 'Telegram'
          ? `@test_customer_${String(timestamp).slice(-4)}`
          : null,
      email:
        channel === 'Website Chatbot'
          ? `test${String(timestamp).slice(-4)}@customer.com`
          : null,
      ta_coin_user_id: `TAU-${String(timestamp).slice(-5)}`,
      source_channel: channel,
    })
    .select()
    .single();

  if (customerError) {
    console.error('Error creating test customer:', customerError);
    throw customerError;
  }

  const testMessage =
    channel === 'Telegram'
      ? 'Hello, I need help with my T.A Coin account.'
      : 'Hi, I have a question about using the website chatbot.';

  return createSession({
    customerId: customer.id,
    channel,
    lastMessage: testMessage,
  });
};

export const updateSessionStatus = async ({
  sessionId,
  status,
  auditDetails,
}) => {
  const updateData = {
    status,
  };

  if (status === 'Ended') {
    updateData.ended_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('sessions')
    .update(updateData)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating session status:', error);
    throw error;
  }

  await supabase.from('audit_logs').insert({
    user_name: 'Agent Dara',
    role: 'Admin',
    action: `Session Status Updated to ${status}`,
    details: auditDetails || `Session status changed to ${status}.`,
  });

  return data;
};

export const endSession = async (sessionId) => {
  return updateSessionStatus({
    sessionId,
    status: 'Ended',
    auditDetails: 'Customer conversation session ended by agent.',
  });
};

export const sendSessionReply = async ({ sessionId, messageText }) => {
  const { data, error } = await supabase
    .from('sessions')
    .update({
      last_message: messageText,
      status: 'Active',
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('Error sending session reply:', error);
    throw error;
  }

  await supabase.from('audit_logs').insert({
    user_name: 'Agent Dara',
    role: 'Admin',
    action: 'Session Reply Sent',
    details: `Agent replied in session: ${messageText}`,
  });

  return data;
};

export const submitSessionRating = async ({
  sessionId,
  rating,
  ratingComment,
}) => {
  const { data, error } = await supabase
    .from('sessions')
    .update({
      rating,
      rating_comment: ratingComment || null,
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('Error submitting session rating:', error);
    throw error;
  }

  await supabase.from('audit_logs').insert({
    user_name: 'Customer',
    role: 'Customer',
    action: 'Session Rated',
    details: `Customer rated session ${rating}/5.`,
  });

  return data;
};