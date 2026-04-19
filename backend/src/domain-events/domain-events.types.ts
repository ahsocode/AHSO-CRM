export const DOMAIN_EVENT_NAMES = [
  "customer.created",
  "customer.updated",
  "customer.deleted",
  "customer.assigned",
  "project.created",
  "project.status_changed",
  "quote.sent",
  "quote.accepted",
  "quote.rejected",
  "contract.signed",
  "contract.completed",
  "payment.received",
  "payment.overdue",
  "milestone.due_soon",
  "activity.assigned",
  "mention.created"
] as const;

export type DomainEventName = (typeof DOMAIN_EVENT_NAMES)[number];

export interface DomainEventEnvelope<TPayload = Record<string, unknown>> {
  event: DomainEventName;
  payload: TPayload;
  occurredAt: string;
}
