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
