/**
 * Type definitions for Instantly Reply webhook payload (simplified for MVP)
 */

export type InstantlyReplyPayload = {
  event?: string; // "reply"
  campaign_id?: string;
  lead?: {
    email?: string;
    full_name?: string;
    company?: string;
    website?: string;
    linkedin_url?: string;
  };
  message?: {
    subject?: string;
    snippet?: string;
    text?: string;
    received_at?: string; // ISO
  };
  idempotency_key?: string;
};
