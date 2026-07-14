// Client-guvenli scan tipleri/etiketleri (node importu YOK; hem client hem server kullanir).

export type ScanPhase = "idle" | "find" | "enrich" | "analyze" | "outreach" | "done" | "error";

export interface ScanStatus {
  running: boolean;
  phase: ScanPhase;
  startedAt?: string;
  finishedAt?: string;
  queries: string[];
  queryIndex: number;
  queryTotal: number;
  found: number;
  message?: string;
  // Firma-bazlı mod (opsiyonel).
  mode?: "sector" | "company";
  items?: CompanyScanItem[];
}

export const PHASE_LABEL: Record<ScanPhase, string> = {
  idle: "Bekliyor",
  find: "Firmalar bulunuyor",
  enrich: "Web siteleri taranıyor",
  analyze: "Analiz ediliyor",
  outreach: "Mesajlar üretiliyor",
  done: "Tamamlandı",
  error: "Hata",
};

// --- Firma-bazlı (company) mod: firma başı ilerleme ---
export type CompanyItemPhase =
  | "waiting"
  | "searching"
  | "scraping"
  | "enriching"
  | "ai_analyzing"
  | "competitor_analyzing"
  | "completed"
  | "error";

export interface CompanyScanItem {
  name: string;
  phase: CompanyItemPhase;
  leadId?: string;
  message?: string;
}

export const ITEM_PHASE_LABEL: Record<CompanyItemPhase, string> = {
  waiting: "Bekliyor",
  searching: "Aranıyor",
  scraping: "Site taranıyor",
  enriching: "Zenginleştiriliyor",
  ai_analyzing: "AI analiz ediyor",
  competitor_analyzing: "Rakip analizi",
  completed: "Tamamlandı",
  error: "Hata",
};

// ScanStatus'a firma-bazlı alanlar (opsiyonel — sektör modu etkilenmez).
export interface CompanyScanFields {
  mode?: "sector" | "company";
  items?: CompanyScanItem[];
}
