import { z } from "zod";

export const moduleIds = ["contratos", "obras", "receitas"] as const;
export const moduleIdSchema = z.enum(moduleIds);
export type ModuleId = z.infer<typeof moduleIdSchema>;

export const capabilitySchema = z
  .object({
    status: z.enum(["planned", "available", "unavailable", "not-started"]),
    connectorId: z.string().min(1).nullable(),
    note: z.string().min(1),
  })
  .refine(
    (value) => value.status !== "available" || value.connectorId !== null,
    {
      message: "Módulo disponível exige um conector identificado.",
    },
  );

export const municipalitySchema = z.object({
  ibgeId: z.string().regex(/^11\d{5}$/),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  state: z.literal("RO"),
  stage: z.enum(["pilot", "planned", "not-started"]),
  description: z.string().min(1),
  modules: z.object({
    contratos: capabilitySchema,
    obras: capabilitySchema,
    receitas: capabilitySchema,
  }),
});
export type Municipality = z.infer<typeof municipalitySchema>;

export const moduleLabels: Record<ModuleId, string> = {
  contratos: "Contratos",
  obras: "Obras",
  receitas: "Receitas",
};
