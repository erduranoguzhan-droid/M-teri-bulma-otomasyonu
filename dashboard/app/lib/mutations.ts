import { FOLLOWUP_DAYS, type ContactChannel, type CrmStatus, type Lead } from "./types";

// Takip listesinde tutulacak (hala acik) statuler.
export const OPEN_STATUSES: CrmStatus[] = ["iletisim_kuruldu", "yanit_bekleniyor", "takip"];

/** Backend-bagimsiz alan degisikligi. followUpAt: null => takibi temizle. */
export interface LeadMutation {
  crmStatus?: CrmStatus;
  contactedAt?: string;
  contactChannel?: ContactChannel;
  followUpAt?: string | null;
  dealValue?: number | null; // elle girilen anlasma degeri; null => tahmine don
}

export function dealValueMutation(value: number | null): LeadMutation {
  return { dealValue: value };
}

export function statusMutation(_lead: Lead, status: CrmStatus): LeadMutation {
  const m: LeadMutation = { crmStatus: status };
  if (!OPEN_STATUSES.includes(status)) m.followUpAt = null; // acik degilse takibi birak
  return m;
}

export function contactedMutation(lead: Lead, channel: ContactChannel): LeadMutation {
  const now = new Date();
  const m: LeadMutation = {
    contactedAt: now.toISOString(),
    contactChannel: channel,
    followUpAt: new Date(now.getTime() + FOLLOWUP_DAYS * 86_400_000).toISOString(),
  };
  if (lead.crmStatus === "yeni") m.crmStatus = "iletisim_kuruldu";
  return m;
}

export function snoozeMutation(lead: Lead, days: number): LeadMutation {
  const m: LeadMutation = { followUpAt: new Date(Date.now() + days * 86_400_000).toISOString() };
  if (lead.crmStatus === "iletisim_kuruldu") m.crmStatus = "takip";
  return m;
}

/** JSON tarafi: mutasyonu Lead nesnesine uygula. */
export function applyToLead(lead: Lead, m: LeadMutation): void {
  if (m.crmStatus !== undefined) lead.crmStatus = m.crmStatus;
  if (m.contactedAt !== undefined) lead.contactedAt = m.contactedAt;
  if (m.contactChannel !== undefined) lead.contactChannel = m.contactChannel;
  if (m.followUpAt === null) delete lead.followUpAt;
  else if (m.followUpAt !== undefined) lead.followUpAt = m.followUpAt;
  if (m.dealValue === null) delete lead.dealValue;
  else if (m.dealValue !== undefined) lead.dealValue = m.dealValue;
  lead.updatedAt = new Date().toISOString();
}

/** Supabase tarafi: mutasyonu snake_case update nesnesine cevir. */
export function mutationToRow(m: LeadMutation): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (m.crmStatus !== undefined) row.crm_status = m.crmStatus;
  if (m.contactedAt !== undefined) row.contacted_at = m.contactedAt;
  if (m.contactChannel !== undefined) row.contact_channel = m.contactChannel;
  if (m.followUpAt !== undefined) row.follow_up_at = m.followUpAt; // null da gecerli (temizler)
  if (m.dealValue !== undefined) row.deal_value = m.dealValue; // null da gecerli
  return row;
}

export function isFollowUpDue(lead: Lead, now = Date.now()): boolean {
  if (!lead.followUpAt) return false;
  if (!OPEN_STATUSES.includes(lead.crmStatus)) return false;
  return new Date(lead.followUpAt).getTime() <= now;
}
