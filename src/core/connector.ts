import type { ModuleId } from "./municipality";

// Contrato inicial. A coleta e o armazenamento serão implementados por etapas.
export interface SourceReference {
  id: string;
  name: string;
  url: string;
}

export interface CollectedBatch {
  municipality: string;
  module: ModuleId;
  collectedAt: string;
  source: SourceReference;
  records: readonly unknown[];
  coverage: {
    complete: boolean;
    expectedCount: number | null;
    receivedCount: number;
  };
}

export interface MunicipalConnector {
  id: string;
  municipality: string;
  modules: readonly ModuleId[];
  collect(module: ModuleId, signal: AbortSignal): Promise<CollectedBatch>;
}

// O namespace impede que municípios e módulos compartilhem a mesma chave.
// A revisão do formato será incrementada quando o contrato do snapshot mudar.
export function snapshotKey(municipality: string, module: ModuleId): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(municipality))
    throw new Error("Slug de município inválido.");
  if (!["contratos", "obras", "receitas"].includes(module))
    throw new Error("Módulo inválido.");
  return `observatorio:ro:${municipality}:${module}:v1:latest`;
}
