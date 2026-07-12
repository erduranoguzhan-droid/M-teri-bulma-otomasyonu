import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CrmStatus, Lead, RawCompany } from "./types.js";
import { dedupeKey } from "./dedupe.js";
import { config, requireSupabase } from "./config.js";

/**
 * Depolama arayuzu. Pipeline sadece bunu bilir; arkasinda JSON veya Supabase olabilir.
 */
export interface LeadStore {
  all(): Promise<Lead[]>;
  get(id: string): Promise<Lead | undefined>;
  upsertRaw(raw: RawCompany): Promise<Lead>;
  save(lead: Lead): Promise<void>;
  setStatus(id: string, status: CrmStatus): Promise<void>;
}

export const DEFAULT_DB_PATH = "data/leads.json";

/** Config'e gore dogru store'u dondurur. */
export function createStore(): LeadStore {
  return config.storageBackend === "supabase"
    ? new SupabaseLeadStore()
    : new JsonLeadStore(DEFAULT_DB_PATH);
}

function newLead(raw: RawCompany): Lead {
  const now = new Date().toISOString();
  return { id: randomUUID(), stage: "found", crmStatus: "yeni", createdAt: now, updatedAt: now, raw };
}

// ---------------------------------------------------------------------------
// JSON dosya deposu (yerel gelistirme / dusuk hacim)
// ---------------------------------------------------------------------------
export class JsonLeadStore implements LeadStore {
  private cache: Lead[] | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<Lead[]> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await readFile(this.filePath, "utf8")) as Lead[];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  // Paralel save cagrilari ayni tmp dosyasina yazip bozmasin diye yazmalari
  // seri kuyruga alir. Onceki yazma hata verse bile kuyruk tikanmaz.
  private persist(): Promise<void> {
    const next = this.writeChain.catch(() => {}).then(() => this.doPersist());
    this.writeChain = next.catch(() => {});
    return next;
  }

  private async doPersist(): Promise<void> {
    const leads = this.cache ?? [];
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(leads, null, 2), "utf8");
    await rename(tmp, this.filePath);
  }

  async all(): Promise<Lead[]> {
    return [...(await this.load())];
  }

  async get(id: string): Promise<Lead | undefined> {
    return (await this.load()).find((l) => l.id === id);
  }

  async upsertRaw(raw: RawCompany): Promise<Lead> {
    const leads = await this.load();
    const key = dedupeKey(raw);
    const existing = leads.find((l) => dedupeKey(l.raw) === key);
    if (existing) {
      existing.raw = { ...raw, ...existing.raw };
      existing.updatedAt = new Date().toISOString();
      await this.persist();
      return existing;
    }
    const lead = newLead(raw);
    leads.push(lead);
    await this.persist();
    return lead;
  }

  async save(lead: Lead): Promise<void> {
    const leads = await this.load();
    const idx = leads.findIndex((l) => l.id === lead.id);
    lead.updatedAt = new Date().toISOString();
    if (idx >= 0) leads[idx] = lead;
    else leads.push(lead);
    await this.persist();
  }

  async setStatus(id: string, status: CrmStatus): Promise<void> {
    const lead = await this.get(id);
    if (!lead) throw new Error(`Lead bulunamadi: ${id}`);
    lead.crmStatus = status;
    lead.updatedAt = new Date().toISOString();
    await this.save(lead);
  }
}

// ---------------------------------------------------------------------------
// Supabase deposu (kalici / cok kullanici / deploy)
// ---------------------------------------------------------------------------
type Row = {
  id: string;
  stage: string;
  crm_status: string;
  created_at: string;
  updated_at: string;
  lead_score: number | null;
  contacted_at: string | null;
  contact_channel: string | null;
  follow_up_at: string | null;
  deal_value: number | null;
  dedupe_key: string;
  raw: Lead["raw"];
  enrichment: Lead["enrichment"] | null;
  analysis: Lead["analysis"] | null;
  outreach: Lead["outreach"] | null;
  scan_mode: Lead["scanMode"] | null;
  intelligence: Lead["intelligence"] | null;
};

export function leadToRow(lead: Lead): Row {
  return {
    id: lead.id,
    stage: lead.stage,
    crm_status: lead.crmStatus,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
    lead_score: lead.analysis?.leadScore ?? null,
    contacted_at: lead.contactedAt ?? null,
    contact_channel: lead.contactChannel ?? null,
    follow_up_at: lead.followUpAt ?? null,
    deal_value: lead.dealValue ?? null,
    dedupe_key: dedupeKey(lead.raw),
    raw: lead.raw,
    enrichment: lead.enrichment ?? null,
    analysis: lead.analysis ?? null,
    outreach: lead.outreach ?? null,
    scan_mode: lead.scanMode ?? null,
    intelligence: lead.intelligence ?? null,
  };
}

export function rowToLead(r: Row): Lead {
  return {
    id: r.id,
    stage: r.stage as Lead["stage"],
    crmStatus: r.crm_status as CrmStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    raw: r.raw,
    enrichment: r.enrichment ?? undefined,
    analysis: r.analysis ?? undefined,
    outreach: r.outreach ?? undefined,
    scanMode: r.scan_mode ?? undefined,
    intelligence: r.intelligence ?? undefined,
    contactedAt: r.contacted_at ?? undefined,
    contactChannel: (r.contact_channel as Lead["contactChannel"]) ?? undefined,
    followUpAt: r.follow_up_at ?? undefined,
    dealValue: r.deal_value ?? undefined,
  };
}

export class SupabaseLeadStore implements LeadStore {
  private readonly sb: SupabaseClient;

  constructor() {
    const { url, key } = requireSupabase();
    this.sb = createClient(url, key, { auth: { persistSession: false } });
  }

  async all(): Promise<Lead[]> {
    const { data, error } = await this.sb.from("leads").select("*").order("created_at");
    if (error) throw new Error(`Supabase all: ${error.message}`);
    return (data as Row[]).map(rowToLead);
  }

  async get(id: string): Promise<Lead | undefined> {
    const { data, error } = await this.sb.from("leads").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase get: ${error.message}`);
    return data ? rowToLead(data as Row) : undefined;
  }

  async upsertRaw(raw: RawCompany): Promise<Lead> {
    const key = dedupeKey(raw);
    const { data: existing, error: selErr } = await this.sb
      .from("leads")
      .select("*")
      .eq("dedupe_key", key)
      .maybeSingle();
    if (selErr) throw new Error(`Supabase upsertRaw select: ${selErr.message}`);

    if (existing) {
      const lead = rowToLead(existing as Row);
      lead.raw = { ...raw, ...lead.raw };
      await this.save(lead);
      return lead;
    }
    const lead = newLead(raw);
    await this.save(lead);
    return lead;
  }

  async save(lead: Lead): Promise<void> {
    lead.updatedAt = new Date().toISOString();
    const { error } = await this.sb.from("leads").upsert(leadToRow(lead), { onConflict: "id" });
    if (error) throw new Error(`Supabase save: ${error.message}`);
  }

  async setStatus(id: string, status: CrmStatus): Promise<void> {
    const { error } = await this.sb
      .from("leads")
      .update({ crm_status: status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`Supabase setStatus: ${error.message}`);
  }
}
