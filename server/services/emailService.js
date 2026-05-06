const REQUIRED_EMAIL_KEYS = ["IT_TEAM_EMAIL", "HR_MANAGER_EMAIL", "MAIL_FROM", "APP_BASE_URL"];

function splitRecipients(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getEmailConfig() {
  return {
    itTeamEmail: process.env.IT_TEAM_EMAIL || "",
    hrManagerEmail: process.env.HR_MANAGER_EMAIL || "",
    mailFrom: process.env.MAIL_FROM || "",
    appBaseUrl: process.env.APP_BASE_URL || "",
    missingKeys: REQUIRED_EMAIL_KEYS.filter((key) => !process.env[key]),
  };
}

export function getPublicEmailConfig() {
  const config = getEmailConfig();

  return {
    itTeamEmail: config.itTeamEmail ? "Configured" : "IT_TEAM_EMAIL",
    hrManagerEmail: config.hrManagerEmail ? "Configured" : "HR_MANAGER_EMAIL",
    mailFrom: config.mailFrom ? "Configured" : "MAIL_FROM",
    appBaseUrl: config.appBaseUrl || "APP_BASE_URL",
    allowedEmailDomain: process.env.ALLOWED_EMAIL_DOMAIN || "demo.qpms.local",
    missingKeys: config.missingKeys,
  };
}

export async function notifyTicketRaised(ticket) {
  const config = getEmailConfig();
  return sendEmail({
    eventType: "RAISED",
    ticketNumber: ticket.ticket_number || ticket.ticketNumber,
    from: config.mailFrom,
    to: splitRecipients(config.itTeamEmail),
    cc: splitRecipients(config.hrManagerEmail),
    subject: `Hardware ticket raised: ${ticket.ticket_number || ticket.ticketNumber}`,
    text: [
      `Ticket: ${ticket.ticket_number || ticket.ticketNumber}`,
      `Employee: ${ticket.employee_name || ticket.employeeName} <${ticket.employee_email || ticket.employeeEmail}>`,
      `Type: ${ticket.ticket_type || ticket.ticketType}`,
      `Subject: ${ticket.subject}`,
      `Open: ${config.appBaseUrl}`,
    ].join("\n"),
    missingKeys: config.missingKeys,
  });
}

export async function notifyTicketClosed(ticket) {
  const config = getEmailConfig();
  return sendEmail({
    eventType: "CLOSED",
    ticketNumber: ticket.ticket_number || ticket.ticketNumber,
    from: config.mailFrom,
    to: splitRecipients(ticket.employee_email || ticket.employeeEmail),
    cc: splitRecipients(config.hrManagerEmail),
    subject: `Hardware ticket resolved: ${ticket.ticket_number || ticket.ticketNumber}`,
    text: [
      `Ticket: ${ticket.ticket_number || ticket.ticketNumber}`,
      `Status: ${ticket.status}`,
      `Resolution: ${ticket.resolution_note || ticket.resolutionNote || "Resolved by IT team."}`,
      `Open: ${config.appBaseUrl}`,
    ].join("\n"),
    missingKeys: config.missingKeys,
  });
}

async function sendEmail(message) {
  const hasRecipients = message.to.length > 0 && message.from;
  const status = hasRecipients && message.missingKeys.length === 0 ? "Queued" : "Config Missing";

  return {
    ok: status === "Queued",
    status,
    mode: "server-email-adapter",
    eventType: message.eventType,
    ticketNumber: message.ticketNumber,
    toLabel: message.eventType === "RAISED" ? "IT_TEAM_EMAIL" : "Employee email",
    ccLabel: "HR_MANAGER_EMAIL",
    subject: message.subject,
    missingKeys: message.missingKeys,
    preview: {
      from: message.from ? "MAIL_FROM" : "",
      toCount: message.to.length,
      ccCount: message.cc.length,
      text: message.text,
    },
  };
}
