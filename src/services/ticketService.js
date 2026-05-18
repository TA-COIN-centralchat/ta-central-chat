import { supabase } from './supabaseClient';
export const createCategory = async (formData) => {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: formData.name,
      description: formData.description || null,
      status: 'Active',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating category:', error);
    throw error;
  }

  await supabase.from('audit_logs').insert({
    user_name: 'Agent Dara',
    role: 'Admin',
    action: 'Category Created',
    details: `New category created: ${formData.name}.`,
  });

  return data;
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
    assignedAgentId: ticket.assigned_agent_id,
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

export const sendTicketMessage = async ({
  ticketId,
  senderType,
  senderName,
  messageText,
  isInternalNote = false,
}) => {
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

export const getAgents = async () => {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching agents:', error);
    throw error;
  }

  return data.map((agent) => ({
    id: agent.id,
    name: agent.full_name,
    role: agent.role,
    email: agent.email,
    status: agent.status,
    activeTickets: agent.active_tickets || 0,
    resolvedToday: agent.resolved_today || 0,
  }));
};

export const getRawAgents = async () => {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Error fetching raw agents:', error);
    throw error;
  }

  return data || [];
};

export const createAgent = async (formData) => {
  const { data, error } = await supabase
    .from('agents')
    .insert({
      full_name: formData.fullName,
      email: formData.email,
      role: formData.role,
      status: 'Offline',
      active_tickets: 0,
      resolved_today: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating agent:', error);
    throw error;
  }

  await supabase.from('audit_logs').insert({
    user_name: 'Agent Dara',
    role: 'Admin',
    action: 'Agent Created',
    details: `New agent account created for ${formData.fullName} (${formData.role}). Default status set to Offline.`,
  });

  return data;
};

export const createTicketWithAutoAssign = async (formData) => {
  const { data: availableAgents, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'Available')
    .order('active_tickets', { ascending: true });

  if (agentError) {
    console.error('Error finding available agent:', agentError);
    throw agentError;
  }

  let selectedAgent = null;

  if (availableAgents && availableAgents.length > 0) {
    const lowestWorkload = Math.min(
      ...availableAgents.map((agent) => agent.active_tickets || 0)
    );

    const lowestAgents = availableAgents.filter(
      (agent) => (agent.active_tickets || 0) === lowestWorkload
    );

    const randomIndex = Math.floor(Math.random() * lowestAgents.length);
    selectedAgent = lowestAgents[randomIndex];
  }

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

  const ticketNumber = `TAC-${Date.now()}`;

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

export const autoAssignWaitingTickets = async () => {
  const { data: waitingTickets, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .or('status.eq.New,assigned_agent_id.is.null')
    .order('created_at', { ascending: true });

  if (ticketError) {
    console.error('Error loading waiting tickets:', ticketError);
    throw ticketError;
  }

  if (!waitingTickets || waitingTickets.length === 0) {
    return {
      assignedCount: 0,
      message: 'No waiting tickets found.',
    };
  }

  const { data: availableAgents, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'Available');

  if (agentError) {
    console.error('Error loading available agents:', agentError);
    throw agentError;
  }

  if (!availableAgents || availableAgents.length === 0) {
    return {
      assignedCount: 0,
      message: 'No available agents. Tickets remain in queue.',
    };
  }

  let assignedCount = 0;

  const agentPool = availableAgents.map((agent) => ({
    ...agent,
    active_tickets: agent.active_tickets || 0,
  }));

  for (const ticket of waitingTickets) {
    const lowestWorkload = Math.min(
      ...agentPool.map((agent) => agent.active_tickets || 0)
    );

    const lowestAgents = agentPool.filter(
      (agent) => (agent.active_tickets || 0) === lowestWorkload
    );

    const randomIndex = Math.floor(Math.random() * lowestAgents.length);
    const selectedAgent = lowestAgents[randomIndex];

    const { error: updateTicketError } = await supabase
      .from('tickets')
      .update({
        assigned_agent_id: selectedAgent.id,
        status: 'Assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    if (updateTicketError) {
      console.error('Error assigning ticket:', updateTicketError);
      throw updateTicketError;
    }

    const newActiveTicketCount = (selectedAgent.active_tickets || 0) + 1;

    const { error: updateAgentError } = await supabase
      .from('agents')
      .update({
        active_tickets: newActiveTicketCount,
      })
      .eq('id', selectedAgent.id);

    if (updateAgentError) {
      console.error('Error updating agent workload:', updateAgentError);
      throw updateAgentError;
    }

    selectedAgent.active_tickets = newActiveTicketCount;

    const poolIndex = agentPool.findIndex(
      (agent) => agent.id === selectedAgent.id
    );

    if (poolIndex !== -1) {
      agentPool[poolIndex].active_tickets = newActiveTicketCount;
    }

    await supabase.from('audit_logs').insert({
      user_name: 'System',
      role: 'System',
      action: 'Queue Ticket Auto Assigned',
      ticket_id: ticket.id,
      details: `Ticket ${ticket.ticket_number} was auto-assigned to ${selectedAgent.full_name}.`,
    });

    assignedCount += 1;
  }

  return {
    assignedCount,
    message: `${assignedCount} waiting ticket(s) auto-assigned successfully.`,
  };
};

export const reassignTicket = async ({ ticketId, newAgentId, reason }) => {
  const { data: currentTicket, error: ticketError } = await supabase
    .from('tickets')
    .select('id, ticket_number, assigned_agent_id')
    .eq('id', ticketId)
    .single();

  if (ticketError) {
    console.error('Error fetching current ticket:', ticketError);
    throw ticketError;
  }

  const oldAgentId = currentTicket.assigned_agent_id;

  let oldAgent = null;

  if (oldAgentId) {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', oldAgentId)
      .single();

    if (!error) {
      oldAgent = data;
    }
  }

  const { data: newAgent, error: newAgentError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', newAgentId)
    .single();

  if (newAgentError) {
    console.error('Error fetching new agent:', newAgentError);
    throw newAgentError;
  }

  const { data: updatedTicket, error: updateTicketError } = await supabase
    .from('tickets')
    .update({
      assigned_agent_id: newAgentId,
      status: 'Assigned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (updateTicketError) {
    console.error('Error reassigning ticket:', updateTicketError);
    throw updateTicketError;
  }

  if (oldAgent) {
    await supabase
      .from('agents')
      .update({
        active_tickets: Math.max((oldAgent.active_tickets || 0) - 1, 0),
      })
      .eq('id', oldAgent.id);
  }

  await supabase
    .from('agents')
    .update({
      active_tickets: (newAgent.active_tickets || 0) + 1,
    })
    .eq('id', newAgent.id);

  await supabase.from('audit_logs').insert({
    user_name: 'Agent Dara',
    role: 'Admin',
    action: 'Ticket Reassigned',
    ticket_id: ticketId,
    details: `Ticket ${currentTicket.ticket_number} reassigned from ${
      oldAgent?.full_name || 'Unassigned'
    } to ${newAgent.full_name}. Reason: ${reason || 'No reason provided.'}`,
  });

  return {
    updatedTicket,
    oldAgent,
    newAgent,
  };
};