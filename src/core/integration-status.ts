import type { Municipality } from "./municipality";

export const integrationStatusLabels = {
  integrated: "Integrados",
  "in-progress": "Em andamento",
  "not-integrated": "Não integrados",
} as const;

export type IntegrationStatus = keyof typeof integrationStatusLabels;

export function getIntegrationStatus(
  municipality: Pick<Municipality, "stage" | "modules">,
): IntegrationStatus {
  if (
    Object.values(municipality.modules).some(
      (module) => module.status === "available",
    )
  )
    return "integrated";

  return municipality.stage === "pilot" ? "in-progress" : "not-integrated";
}
