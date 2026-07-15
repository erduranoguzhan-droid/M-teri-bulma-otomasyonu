// Veri katmani yonlendiricisi: STORAGE_BACKEND=supabase ise Supabase, degilse JSON.
// Diger dosyalar sadece bu modulu import eder (backend degisimi seffaf).
import * as jsonStore from "./store-json";
import * as supabaseStore from "./store-supabase";
import { isFollowUpDue } from "./mutations";
import type { ContactChannel, CrmStatus, Lead } from "./types";

const impl = process.env.STORAGE_BACKEND === "supabase" ? supabaseStore : jsonStore;

export function getLeads(): Promise<Lead[]> {
  return impl.getLeads();
}
export function getLead(id: string): Promise<Lead | undefined> {
  return impl.getLead(id);
}
export function getLeadsByScan(scanId: string): Promise<Lead[]> {
  return impl.getLeadsByScan(scanId);
}
export function setStatus(id: string, status: CrmStatus): Promise<void> {
  return impl.setStatus(id, status);
}
export function markContacted(id: string, channel: ContactChannel): Promise<void> {
  return impl.markContacted(id, channel);
}
export function snoozeFollowUp(id: string, days: number): Promise<void> {
  return impl.snoozeFollowUp(id, days);
}
export function setDealValue(id: string, value: number | null): Promise<void> {
  return impl.setDealValue(id, value);
}

export { isFollowUpDue };
