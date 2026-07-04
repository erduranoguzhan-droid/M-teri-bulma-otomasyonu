import { promises as fs } from "fs";
import path from "path";
import type { ContactChannel, CrmStatus, Lead } from "./types";
import {
  applyToLead,
  contactedMutation,
  dealValueMutation,
  snoozeMutation,
  statusMutation,
} from "./mutations";

const DB_PATH = path.join(process.cwd(), "..", "data", "leads.json");

async function readAll(): Promise<Lead[]> {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, "utf8")) as Lead[];
  } catch {
    return [];
  }
}

async function writeAll(leads: Lead[]): Promise<void> {
  const tmp = `${DB_PATH}.dash.tmp`;
  await fs.writeFile(tmp, JSON.stringify(leads, null, 2), "utf8");
  await fs.rename(tmp, DB_PATH);
}

async function mutate(id: string, make: (l: Lead) => void): Promise<void> {
  const leads = await readAll();
  const lead = leads.find((l) => l.id === id);
  if (!lead) return;
  make(lead);
  await writeAll(leads);
}

export async function getLeads(): Promise<Lead[]> {
  return readAll();
}

export async function getLead(id: string): Promise<Lead | undefined> {
  return (await readAll()).find((l) => l.id === id);
}

export async function setStatus(id: string, status: CrmStatus): Promise<void> {
  await mutate(id, (l) => applyToLead(l, statusMutation(l, status)));
}

export async function markContacted(id: string, channel: ContactChannel): Promise<void> {
  await mutate(id, (l) => applyToLead(l, contactedMutation(l, channel)));
}

export async function snoozeFollowUp(id: string, days: number): Promise<void> {
  await mutate(id, (l) => applyToLead(l, snoozeMutation(l, days)));
}

export async function setDealValue(id: string, value: number | null): Promise<void> {
  await mutate(id, (l) => applyToLead(l, dealValueMutation(value)));
}
