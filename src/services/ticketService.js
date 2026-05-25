import { supabase } from './supabaseClient';

/* =========================
   Helpers
========================= */

const formatTime = (dateValue) => {
  if (!dateValue) return '-';

  return new Date(dateValue).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const logSupabaseError = (label, error) => {
  console.error(label, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
  });
};

const getCurrentUserRole = () => {
  return localStorage.getItem('currentUserRole');
};

const getCurrentAgentId = () => {
  return localStorage.getItem('currentAgentId');
};

const isAdmin = () => {
  return getCurrentUserRole() === 'Admin';
};

const createAuditLog = async ({
  userName = 'System',
  role = 'System',
  action,
  ticketId = null,
  details,
}) => {
  const { error } = await supabase.from('audit_logs').insert({
    user_name: userName,
    role,
    action,
    ticket_id: ticketId,
    details,
  });

  if (error) {
    logSupabaseError('Error creating audit log:', error);
  }
};

const mapTicket = (ticket) => {
  return {
    id: ticket.ticket_number,
    dbId: ticket.id,

    customer: ticket.customers?.full_name || 'Unknown Customer',
    customerId: ticket.customer_id,

    channel: ticket.channel || '-',
    category: ticket.issue_type || '-',
    subCategory: ticket.sub_category || '',
    status: ticket.status || 'New',

    assignedTo: ticket.agents?.full_name || 'Unassigned',
    assignedAgentId: ticket.assigned_agent_id,

    lastMessage: ticket.issue_description || '',
    time: formatTime(ticket.created_at),

    infoComplete: Boolean(ticket.customer_info_complete),

    phone: ticket.customers?.phone || '',
    telegram: ticket.customers?.telegram_username || '',
    email: ticket.customers?.email || '',
    accountId: ticket.customers?.ta_coin_user_id || '',

    transactionId: ticket.transaction_id || '',
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
    sessionId: ticket.session_id || null,
  };
};

/* =========================
   Categories
========================= */

export const getCategories = async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .ilike('status', 'active')
    .order('name', { ascending: true });

  if (error) {
    logSupabaseError('Error fetching categories:', error);
    throw error;
  }

  return data || [];
};

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
    logSupabaseError('Error creating category:', error);
    throw error;
  }

  await createAuditLog({
    userName: localStorage.getItem('currentUserName') || 'Admin',
    role: localStorage.getItem('currentUserRole') || 'Admin',
    action: 'Category Created',
    details: `New category created: ${formData.name}.`,
  });

  return data;
};

/* =========================
   Tickets
========================= */

export const getTickets = async () => {
  const currentAgentId = getCurrentAgentId();

  let query = supabase
    .from('tickets')
    .select(`
      *,
      customers (
        id,
        full_name,
        phone,
        email,
        telegram_username,
        ta_coin_user_id,
        source_channel
      ),
      agents (
        id,
        full_name,
        email,
        role,
        status
      )
    `)
    .order('created_at', { ascending: false });

  // Admin can see all tickets.
  // Normal agents can only see tickets assigned to them.
  if (!isAdmin()) {
    if (!currentAgentId) {
      return [];
    }

    query = query.eq('assigned_agent_id', currentAgentId);
  }

  const { data, error } = await query;

  if (error) {
    logSupabaseError('Error fetching tickets:', error);
    throw error;
  }

  return (data || []).map(mapTicket);
};

export const getTicketById = async (ticketId) => {
  const currentAgentId = getCurrentAgentId();

  let query = supabase
    .from('tickets')
    .select(`
      *,
      customers (
        id,
        full_name,
        phone,
        email,
        telegram_username,
        ta_coin_user_id,
        source_channel
      ),
      agents (
        id,
        full_name,
        email,
        role,
        status
      )
    `)
    .eq('id', ticketId)
    .single();

  const { data, error } = await query;

  if (error) {
    logSupabaseError('Error fetching ticket by ID:', error);
    throw error;
  }

  if (!isAdmin() && data.assigned_agent_id !== currentAgentId) {
    throw new Error('You do not have permission to view this ticket.');
  }

  return mapTicket(data);
};

export const createTicketWithAutoAssign = async (formData) => {
  const { data: availableAgents, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'Available')
    .order('active_tickets', { ascending: true });

  if (agentError) {
    logSupabaseError('Error finding available agent:', agentError);
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

    selectedAgent = lowestAgents[Math.floor(Math.random() * lowestAgents.length)];
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({
      full_name: formData.customerName,
      phone: formData.phone || null,
      email: formData.email || null,
      telegram_username: formData.telegram || null,
      ta_coin_user_id: formData.accountId || null,
      source_channel: formData.channel,
    })
    .select()
    .single();

  if (customerError) {
    logSupabaseError('Error creating customer:', customerError);
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
      issue_description: formData.issueDescription || '',
      transaction_id: formData.transactionId || null,
      status: selectedAgent ? 'Assigned' : 'New',
      customer_info_complete: true,
    })
    .select()
    .single();

  if (ticketError) {
    logSupabaseError('Error creating ticket:', ticketError);
    throw ticketError;
  }

  const { error: messageError } = await supabase.from('messages').insert({
    ticket_id: ticket.id,
    sender_type: 'customer',
    sender_name: formData.customerName,
    message_text: formData.issueDescription || 'New support ticket created.',
    is_internal_note: false,
  });

  if (messageError) {
    logSupabaseError('Error creating message:', messageError);
    throw messageError;
  }

  if (formData.internalNote) {
    const { error: noteError } = await supabase.from('internal_notes').insert({
      ticket_id: ticket.id,
      agent_id: selectedAgent?.id || null,
      note_text: formData.internalNote,
    });

    if (noteError) {
      logSupabaseError('Error creating internal note:', noteError);
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
      logSupabaseError('Error updating agent workload:', updateAgentError);
    }
  }

  await createAuditLog({
    userName: 'System',
    role: 'System',
    action: selectedAgent ? 'Ticket Auto Assigned' : 'Ticket Created In Queue',
    ticketId: ticket.id,
    details: selectedAgent
      ? `Ticket ${ticketNumber} assigned to ${selectedAgent.full_name}.`
      : `Ticket ${ticketNumber} created with no available agent.`,
  });

  return {
    ticket,
    assignedAgent: selectedAgent,
  };
};

export const updateTicketStatus = async ({ ticketId, status, auditDetails }) => {
  const currentAgentId = getCurrentAgentId();

  if (!isAdmin()) {
    const { data: existingTicket, error: checkError } = await supabase
      .from('tickets')
      .select('id, assigned_agent_id')
      .eq('id', ticketId)
      .single();

    if (checkError) {
      logSupabaseError('Error checking ticket permission:', checkError);
      throw checkError;
    }

    if (existingTicket.assigned_agent_id !== currentAgentId) {
      throw new Error('You do not have permission to update this ticket.');
    }
  }

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
    logSupabaseError('Error updating ticket status:', error);
    throw error;
  }

  await createAuditLog({
    userName: localStorage.getItem('currentUserName') || 'Agent',
    role: localStorage.getItem('currentUserRole') || 'Customer Service Agent',
    action: `Ticket Status Updated to ${status}`,
    ticketId,
    details: auditDetails || `Ticket status changed to ${status}.`,
  });

  return data;
};

/* =========================
   Messages
========================= */

export const getMessagesByTicketId = async (ticketId) => {
  const currentAgentId = getCurrentAgentId();

  if (!isAdmin()) {
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, assigned_agent_id')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      logSupabaseError('Error checking message permission:', ticketError);
      throw ticketError;
    }

    if (ticket.assigned_agent_id !== currentAgentId) {
      throw new Error('You do not have permission to view messages for this ticket.');
    }
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    logSupabaseError('Error fetching messages:', error);
    throw error;
  }

  return (data || []).map((message) => ({
    id: message.id,
    sender: message.sender_type,
    name: message.sender_name,
    text: message.message_text,
    attachmentUrl: message.attachment_url || null,
    isInternalNote: Boolean(message.is_internal_note),
    time: formatTime(message.created_at),
  }));
};

export const sendTicketMessage = async ({
  ticketId,
  senderType,
  senderName,
  messageText,
  isInternalNote = false,
}) => {
  const currentAgentId = getCurrentAgentId();

  if (!isAdmin()) {
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, assigned_agent_id')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      logSupabaseError('Error checking send message permission:', ticketError);
      throw ticketError;
    }

    if (ticket.assigned_agent_id !== currentAgentId) {
      throw new Error('You do not have permission to reply to this ticket.');
    }
  }

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
    logSupabaseError('Error sending message:', error);
    throw error;
  }

  return {
    id: data.id,
    sender: data.sender_type,
    name: data.sender_name,
    text: data.message_text,
    isInternalNote: Boolean(data.is_internal_note),
    time: formatTime(data.created_at),
  };
};

/* =========================
   Agents
========================= */

export const getAgents = async () => {
  const currentAgentId = getCurrentAgentId();

  let query = supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: false });

  // Admin sees all agents.
  // Agent sees only their own profile.
  if (!isAdmin()) {
    if (!currentAgentId) return [];
    query = query.eq('id', currentAgentId);
  }

  const { data, error } = await query;

  if (error) {
    logSupabaseError('Error fetching agents:', error);
    throw error;
  }

  return (data || []).map((agent) => ({
    id: agent.id,
    authUserId: agent.auth_user_id,
    name: agent.full_name,
    role: agent.role,
    email: agent.email,
    status: agent.status || 'Offline',
    activeTickets: agent.active_tickets || 0,
    resolvedToday: agent.resolved_today || 0,
    createdAt: agent.created_at,
  }));
};

export const getRawAgents = async () => {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) {
    logSupabaseError('Error fetching raw agents:', error);
    throw error;
  }

  if (!isAdmin()) {
    const currentAgentId = getCurrentAgentId();
    return (data || []).filter((agent) => agent.id === currentAgentId);
  }

  return data || [];
};

export const createAgent = async (formData) => {
  if (!isAdmin()) {
    throw new Error('Only Admin can create agent accounts.');
  }

  const { data, error } = await supabase.functions.invoke('create-agent', {
    body: {
      fullName: formData.fullName,
      email: formData.email,
      password: formData.password,
      role: formData.role,
    },
  });

  if (error) {
    console.error('Error invoking create-agent function:', error);
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.agent;
};

/* =========================
   Auto Assignment
========================= */

export const autoAssignWaitingTickets = async () => {
  if (!isAdmin()) {
    throw new Error('Only Admin can auto-assign waiting tickets.');
  }

  const { data: waitingTickets, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .or('status.eq.New,assigned_agent_id.is.null')
    .order('created_at', { ascending: true });

  if (ticketError) {
    logSupabaseError('Error loading waiting tickets:', ticketError);
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
    .eq('status', 'Available')
    .order('active_tickets', { ascending: true });

  if (agentError) {
    logSupabaseError('Error loading available agents:', agentError);
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

    const selectedAgent =
      lowestAgents[Math.floor(Math.random() * lowestAgents.length)];

    const { error: updateTicketError } = await supabase
      .from('tickets')
      .update({
        assigned_agent_id: selectedAgent.id,
        status: 'Assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    if (updateTicketError) {
      logSupabaseError('Error assigning ticket:', updateTicketError);
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
      logSupabaseError('Error updating agent workload:', updateAgentError);
    }

    selectedAgent.active_tickets = newActiveTicketCount;

    const poolIndex = agentPool.findIndex(
      (agent) => agent.id === selectedAgent.id
    );

    if (poolIndex !== -1) {
      agentPool[poolIndex].active_tickets = newActiveTicketCount;
    }

    await createAuditLog({
      userName: 'System',
      role: 'System',
      action: 'Queue Ticket Auto Assigned',
      ticketId: ticket.id,
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
  if (!isAdmin()) {
    throw new Error('Only Admin can reassign tickets.');
  }

  const { data: currentTicket, error: ticketError } = await supabase
    .from('tickets')
    .select('id, ticket_number, assigned_agent_id')
    .eq('id', ticketId)
    .single();

  if (ticketError) {
    logSupabaseError('Error fetching current ticket:', ticketError);
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
    logSupabaseError('Error fetching new agent:', newAgentError);
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
    logSupabaseError('Error reassigning ticket:', updateTicketError);
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

  await createAuditLog({
    userName: localStorage.getItem('currentUserName') || 'Admin',
    role: localStorage.getItem('currentUserRole') || 'Admin',
    action: 'Ticket Reassigned',
    ticketId,
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