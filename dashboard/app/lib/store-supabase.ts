import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ContactChannel, CrmStatus, Lead } from "./types";
import {
  contactedMutation,
  dealValueMutation,
  mutationToRow,
  snoozeMutation,
  statusMutation,
  type LeadMutation,
} from "./mutations";

let sb: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!sb) {
    const url = process.env.SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_KEY ?? "";
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY tanimli degil.");
    sb = createClient(url, key, { auth: { persistSession: false } });
  }
  return sb;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToLead(r: any): Lead {
  return {
    id: r.id,
    stage: r.stage,
    crmStatus: r.crm_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    raw: r.raw,
    enrichment: r.enrichment ?? undefined,
    analysis: r.analysis ?? undefined,
    outreach: r.outreach ?? undefined,
    // Firma-modu AI intelligence + rakip analizi (onceden map edilmiyordu -> panel gorunmuyordu).
    scanMode: r.scan_mode ?? undefined,
    scanId: r.scan_id ?? undefined,
    intelligence: r.intelligence ?? undefined,
    contactedAt: r.contacted_at ?? undefined,
    contactChannel: r.contact_channel ?? undefined,
    followUpAt: r.follow_up_at ?? undefined,
    dealValue: r.deal_value ?? undefined,
  };
}

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await client().from("leads").select("*").order("created_at");
  if (error) throw new Error(`Supabase getLeads: ${error.message}`);
  return (data ?? []).map(rowToLead);
}

export async function getLead(id: string): Promise<Lead | undefined> {
  const { data, error } = await client().from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Supabase getLead: ${error.message}`);
  return data ? rowToLead(data) : undefined;
}

/** Verimli: tum leadleri cekmeden yalniz bu taramanin leadleri (olcek icin). */
export async function getLeadsByScan(scanId: string): Promise<Lead[]> {
  const { data, error } = await client().from("leads").select("*").eq("scan_id", scanId).order("created_at");
  if (error) throw new Error(`Supabase getLeadsByScan: ${error.message}`);
  return (data ?? []).map(rowToLead);
}

async function applyMutation(id: string, make: (lead: Lead) => LeadMutation): Promise<void> {
  const lead = await getLead(id);
  if (!lead) return;
  const { error } = await client().from("leads").update(mutationToRow(make(lead))).eq("id", id);
  if (error) throw new Error(`Supabase update: ${error.message}`);
}

export async function setStatus(id: string, status: CrmStatus): Promise<void> {
  await applyMutation(id, (l) => statusMutation(l, status));
}

export async function markContacted(id: string, channel: ContactChannel): Promise<void> {
  await applyMutation(id, (l) => contactedMutation(l, channel));
}

export async function snoozeFollowUp(id: string, days: number): Promise<void> {
  await applyMutation(id, (l) => snoozeMutation(l, days));
}

export async function setDealValue(id: string, value: number | null): Promise<void> {
  await applyMutation(id, () => dealValueMutation(value));
}
