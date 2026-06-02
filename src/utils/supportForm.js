// Parser for the legacy pre-chat support form. Pre-restructure widget builds
// packed every form field into the first user message of a session as
// label/value lines:
//
//   Support Request
//   Customer Name: Mao sothyda
//   Email: sothyda.mao@gmail.com
//   Phone Number: 09876543
//   Issue Type: Account Issue
//   Issue Details: ...
//
// New widget builds store these as structured fields in chat_sessions.metadata,
// so this parser only matters for sessions written before the widget upgrade.
//
// We scan line-by-line so multi-word labels, weird whitespace, and
// inconsistent capitalization don't break extraction.

export const parseSupportForm = (messageText) => {
  const fields = {};

  String(messageText || '').split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    const colonIndex = line.indexOf(':');
    if (colonIndex <= 0) return;
    const label = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    if (!label || !value) return;
    fields[label] = value;
  });

  return {
    customerName:
      fields['customer name'] ||
      fields['full name'] ||
      fields.name ||
      '',
    email: fields.email || '',
    phone: fields['phone number'] || fields.phone || '',
    issueType: fields['issue type'] || '',
    issueDescription:
      fields['issue details'] ||
      fields['issue description'] ||
      fields.details ||
      '',
  };
};
