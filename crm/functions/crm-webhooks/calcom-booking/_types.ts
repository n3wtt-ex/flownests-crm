/**
 * Type definitions for cal.com booking webhook payload (simplified for MVP)
 */

export type CalcomBookingPayload = {
  event?: string; // e.g., "booking.created"
  booking?: {
    id?: string;
    title?: string;
    start_time?: string; // ISO
    end_time?: string;   // ISO
    attendees?: Array<{
      email?: string;
      name?: string;
    }>;
    metadata?: Record<string, any>;
  };
  // sometimes cal.com payloads include attendees at root level in custom setups
  attendees?: Array<{
    email?: string;
    name?: string;
  }>;
  idempotency_key?: string;
};
