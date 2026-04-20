const { insert } = require('../data/store');

const AUDIT_ACTIONS = {
  LOGIN: 'login',
  QUOTE_VIEW: 'quote_view',
  ATTACHMENT_DOWNLOAD: 'attachment_download',
  QUOTE_CREATE: 'quote_create',
  QUOTE_STATUS_UPDATE: 'quote_status_update',
  POLICY_EMISSION_REQUEST: 'policy_emission_request',
  CONVERSATION_OPEN: 'conversation_open',
};

async function writeAuditLog({
  userId,
  action,
  entityType = null,
  entityId = null,
  metadata = null,
  ipAddress = null,
}) {
  try {
    let metadataJson = null;
    if (metadata != null) {
      try {
        metadataJson = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
      } catch {
        metadataJson = null;
      }
    }
    await insert('audit_logs', {
      user_id: userId != null ? Number(userId) : null,
      action: String(action),
      entity_type: entityType != null ? String(entityType) : null,
      entity_id: entityId != null ? Number(entityId) : null,
      metadata_json: metadataJson,
      ip_address: ipAddress != null ? String(ipAddress).slice(0, 128) : null,
    });
  } catch (err) {
    console.error('writeAuditLog:', err.message || err);
  }
}

module.exports = { writeAuditLog, AUDIT_ACTIONS };
