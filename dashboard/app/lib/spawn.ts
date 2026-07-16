import { spawn } from "child_process";

/**
 * CLI taramasini arka planda (detached) baslatir.
 *
 * Neden tirnak: Windows'ta `npm` bir .cmd dosyasi ve Node onu `shell:false` ile
 * calistirmayi reddediyor (EINVAL) — yani `shell:true` zorunlu. Ama shell:true
 * argumanlari duz bir komut satirina birlestirdigi icin bosluklu degerler
 * ("kafe, restoran") ve bos degerler ("") parcalanir; sonraki bayraklar kayar ve
 * CLI yanlis sorgu uretir. Bu yuzden her argumani platforma gore tirnakliyoruz.
 */
export function spawnNpmDetached(args: string[], cwd: string): void {
  const child = spawn("npm", args.map(quoteArg), {
    cwd,
    detached: true,
    shell: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

/** Tek argumani calisilan shell'e gore guvenli hale getirir. */
export function quoteArg(a: string): string {
  if (process.platform === "win32") {
    // cmd.exe: cift tirnak icinde " karakteri "" ile kacirilir.
    return `"${a.replace(/"/g, '""')}"`;
  }
  // POSIX sh: tek tirnak icinde ' disinda her sey literal.
  return `'${a.replace(/'/g, `'\\''`)}'`;
}
