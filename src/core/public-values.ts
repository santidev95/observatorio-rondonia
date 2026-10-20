import { z } from "zod";
import { containsPersonalDocument } from "./contracts";
export const publicText = z
  .string()
  .refine(
    (s) => !containsPersonalDocument(s),
    "CPF completo não pode ser republicado",
  );
export const civilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => {
    const t = new Date(d + "T00:00:00Z");
    return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === d;
  });
export const municipalUrl = z.url().refine((s) => {
  try {
    const u = new URL(s);
    let d = s;
    for (let i = 0; i < 3; i++) d = decodeURIComponent(d);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      (u.hostname === "portovelho.ro.gov.br" ||
        u.hostname.endsWith(".portovelho.ro.gov.br")) &&
      !containsPersonalDocument(d) &&
      ![...u.searchParams.keys()].some((k) => /cpf/i.test(k))
    );
  } catch {
    return false;
  }
});

export const publicAccountingText = z
  .string()
  .refine(
    (s) => !containsPersonalDocument(s.replace(/^\d{1,20}\s*-\s*/, "")),
    "Rótulo contábil não pode conter CPF completo",
  );
