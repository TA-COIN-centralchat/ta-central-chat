import { supabase } from './supabaseClient';
export const updateTicketStatus = async ({ ticketId, status, auditDetails }) => {
  const { data, error } = await supabase
    .from('tickets')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) {
    console.error('Error updating ticket status:', error);
    throw error;
  }

  await supabase.from('audit_logs').insert({
    user_name: 'Agent Dara',
    role: 'Customer Service Agent',
    action: `Ticket Status Updated to ${status}`,
    ticket_id: ticketId,
    details: auditDetails || `Ticket status changed to ${status}.`,
  });

  return data;
};

export const sendTicketMessage = async ({ ticketId, senderType, senderName, messageText, isInternalNote = false }) => {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      ticket_id: ticketId,
      sender_type: senderType,
      sender_name: senderName,
      message_text: messageText,
      is_internal_note: isInternalNote,
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending message:', error);
    throw error;
  }

  return {
    id: data.id,
    sender: data.sender_type,
    name: data.sender_name,
    text: data.message_text,
    isInternalNote: data.is_internal_note,
    time: new Date(data.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
};

export const getTickets = async () => {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      customers (*),
      agents (*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tickets:', error);
    throw error;
  }

  return data.map((ticket) => ({
    id: ticket.ticket_number,
    dbId: ticket.id,
    customer: ticket.customers?.full_name || 'Unknown Customer',
    channel: ticket.channel,
    category: ticket.issue_type,
    subCategory: ticket.sub_category,
    status: ticket.status,
    assignedTo: ticket.agents?.full_name || 'Unassigned',
    lastMessage: ticket.issue_description,
    time: new Date(ticket.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    infoComplete: ticket.customer_info_complete,
    phone: ticket.customers?.phone,
    telegram: ticket.customers?.telegram_username,
    email: ticket.customers?.email,
    accountId: ticket.customers?.ta_coin_user_id,
    transactionId: ticket.transaction_id,
  }));
};

export const getMessagesByTicketId = async (ticketId) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }

  return data.map((message) => ({
    id: message.id,
    sender: message.sender_type,
    name: message.sender_name,
    text: message.message_text,
    isInternalNote: message.is_internal_note,
    time: new Date(message.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));
};

export const createTicketWithAutoAssign = async (formData) => {
  // 1. Find available agent with lowest active tickets
  const { data: availableAgents, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'Available')
    .order('active_tickets', { ascending: true })
    .limit(1);

  if (agentError) {
    console.error('Error finding available agent:', agentError);
    throw agentError;
  }

  const selectedAgent = availableAgents?.[0] || null;

  // 2. Create customer
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({
      full_name: formData.customerName,
      phone: formData.phone,
      email: formData.email || null,
      telegram_username: formData.telegram || null,
      ta_coin_user_id: formData.accountId || null,
      source_channel: formData.channel,
    })
    .select()
    .single();

  if (customerError) {
    console.error('Error creating customer:', customerError);
    throw customerError;
  }

  // 3. Generate ticket number
  const ticketNumber = `TAC-${Date.now()}`;

  // 4. Create ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      ticket_number: ticketNumber,
      customer_id: customer.id,
      assigned_agent_id: selectedAgent?.id || null,
      channel: formData.channel,
      issue_type: formData.issueType,
      sub_category: formData.subCategory || null,
      issue_description: formData.issueDescription,
      transaction_id: formData.transactionId || null,
      status: selectedAgent ? 'Assigned' : 'New',
      customer_info_complete: true,
    })
    .select()
    .single();

  if (ticketError) {
    console.error('Error creating ticket:', ticketError);
    throw ticketError;
  }

  // 5. Create first message
  const { error: messageError } = await supabase.from('messages').insert({
    ticket_id: ticket.id,
    sender_type: 'customer',
    sender_name: formData.customerName,
    message_text: formData.issueDescription,
    is_internal_note: false,
  });

  if (messageError) {
    console.error('Error creating message:', messageError);
    throw messageError;
  }

  // 6. Add internal note if provided
  if (formData.internalNote) {
    const { error: noteError } = await supabase.from('internal_notes').insert({
      ticket_id: ticket.id,
      agent_id: selectedAgent?.id || null,
      note_text: formData.internalNote,
    });

    if (noteError) {
      console.error('Error creating internal note:', noteError);
      throw noteError;
    }
  }

  // 7. Update agent workload
  if (selectedAgent) {
    const { error: updateAgentError } = await supabase
      .from('agents')
      .update({
        active_tickets: (selectedAgent.active_tickets || 0) + 1,
      })
      .eq('id', selectedAgent.id);

    if (updateAgentError) {
      console.error('Error updating agent workload:', updateAgentError);
      throw updateAgentError;
    }
  }

  // 8. Create audit log
  const { error: auditError } = await supabase.from('audit_logs').insert({
    user_name: 'System',
    role: 'System',
    action: selectedAgent ? 'Ticket Auto Assigned' : 'Ticket Created In Queue',
    ticket_id: ticket.id,
    details: selectedAgent
      ? `Ticket ${ticketNumber} assigned to ${selectedAgent.full_name}.`
      : `Ticket ${ticketNumber} created with no available agent.`,
  });

  if (auditError) {
    console.error('Error creating audit log:', auditError);
    throw auditError;
  }

  return {
    ticket,
    assignedAgent: selectedAgent,
  };
};