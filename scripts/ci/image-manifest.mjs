import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export const REPOSITORY = "santidev95/observatorio-rondonia";
export const IMAGE = "ghcr.io/" + REPOSITORY;
export const ARTIFACT = "deployment-image";
const shaPattern = /^[a-f0-9]{40}$(?![\s\S])/;
const digestPattern = /^sha256:[a-f0-9]{64}$(?![\s\S])/;
const positive = (value) => Number.isSafeInteger(value) && value > 0;
function ensure(condition, message) {
  if (!condition) throw new Error(message);
}
export function verifyManifest(raw, expected) {
  ensure(
    raw && typeof raw === "object" && !Array.isArray(raw),
    "Manifesto inválido",
  );
  const fields = [
    "schemaVersion",
    "repository",
    "revision",
    "image",
    "digest",
    "runId",
    "runAttempt",
  ];
  ensure(
    Object.keys(raw).length === fields.length &&
      fields.every((k) => Object.hasOwn(raw, k)),
    "Campos inesperados no manifesto",
  );
  ensure(
    raw.schemaVersion === 1 &&
      raw.repository === REPOSITORY &&
      raw.image === IMAGE,
    "Origem da imagem inválida",
  );
  ensure(
    typeof raw.revision === "string" &&
      shaPattern.test(raw.revision) &&
      raw.revision === expected.revision,
    "Revisão divergente",
  );
  ensure(
    typeof raw.digest === "string" && digestPattern.test(raw.digest),
    "Digest inválido",
  );
  ensure(positive(raw.runId) && raw.runId === expected.runId, "CI divergente");
  ensure(
    positive(raw.runAttempt) &&
      positive(expected.runAttempt) &&
      raw.runAttempt <= expected.runAttempt,
    "Tentativa de CI inválida",
  );
  return raw;
}
export function trustedRun(run, revision) {
  return (
    positive(run.id) &&
    positive(run.run_attempt) &&
    run.repository?.full_name === REPOSITORY &&
    run.head_repository?.full_name === REPOSITORY &&
    run.head_sha === revision &&
    run.head_branch === "master" &&
    run.path === ".github/workflows/ci.yml" &&
    ["push", "workflow_dispatch"].includes(run.event)
  );
}
export async function findImageRun(
  revision,
  get,
  { attempts = 120, pause = () => delay(5000) } = {},
) {
  ensure(shaPattern.test(revision), "Revisão inválida");
  const query = new URLSearchParams({
    head_sha: revision,
    branch: "master",
    per_page: "100",
  });
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await get("/actions/workflows/ci.yml/runs?" + query);
    const candidates = (response.workflow_runs ?? []).filter((run) =>
      trustedRun(run, revision),
    );
    for (const run of candidates) {
      if (run.status !== "completed" || run.conclusion !== "success") continue;
      const result = await get(
        "/actions/runs/" + run.id + "/artifacts?per_page=100",
      );
      const artifact = (result.artifacts ?? []).find(
        (a) =>
          a.name === ARTIFACT &&
          !a.expired &&
          positive(a.id) &&
          positive(a.size_in_bytes) &&
          a.size_in_bytes <= 32768 &&
          a.workflow_run?.id === run.id &&
          a.workflow_run?.head_sha === revision,
      );
      if (artifact)
        return {
          revision,
          runId: run.id,
          runAttempt: run.run_attempt,
          artifactId: artifact.id,
        };
    }
    if (attempt + 1 < attempts) await pause();
  }
  throw new Error(
    "Não há manifesto válido de um CI aprovado da master para este commit. Execute o CI nessa revisão; o deploy não reconstrói imagens.",
  );
}
function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  ensure(result.status === 0, "Não foi possível conferir a origem da revisão");
  return result.stdout.trim();
}
export function resolveRevision(ref, runGit = git) {
  ensure(
    typeof ref === "string" &&
      ref.length <= 255 &&
      /^[A-Za-z0-9][A-Za-z0-9._/-]*$(?![\s\S])/.test(ref),
    "Referência inválida",
  );
  const revision = runGit([
    "rev-parse",
    "--verify",
    "--end-of-options",
    ref + "^{commit}",
  ]);
  ensure(shaPattern.test(revision), "Revisão inválida");
  runGit(["merge-base", "--is-ancestor", revision, "origin/master"]);
  return revision;
}
function output(values) {
  ensure(process.env.GITHUB_OUTPUT, "Saída do Actions ausente");
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(values)
      .map(([k, v]) => k + "=" + v + "\n")
      .join(""),
  );
}
async function main() {
  ensure(
    process.env.GITHUB_REPOSITORY === REPOSITORY,
    "Repositório não autorizado",
  );
  const mode = process.argv[2];
  if (mode === "create") {
    ensure(
      process.env.GITHUB_REF === "refs/heads/master" &&
        ["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME),
      "Publicação fora da master confiável",
    );
    const manifest = {
      schemaVersion: 1,
      repository: REPOSITORY,
      revision: process.env.GITHUB_SHA,
      image: IMAGE,
      digest: process.env.IMAGE_DIGEST,
      runId: Number(process.env.GITHUB_RUN_ID),
      runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    };
    verifyManifest(manifest, {
      revision: git(["rev-parse", "HEAD"]),
      runId: manifest.runId,
      runAttempt: manifest.runAttempt,
    });
    fs.writeFileSync(
      "deployment-image.json",
      JSON.stringify(manifest, null, 2) + "\n",
    );
  } else if (mode === "resolve") {
    const revision = resolveRevision(process.env.SOURCE_REF);
    ensure(process.env.GH_TOKEN, "Token do Actions ausente");
    const get = async (path) => {
      const response = await fetch(
        "https://api.github.com/repos/" + REPOSITORY + path,
        {
          redirect: "error",
          signal: AbortSignal.timeout(15000),
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: "Bearer " + process.env.GH_TOKEN,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );
      ensure(
        response.ok,
        "Não foi possível conferir o CI: HTTP " + response.status,
      );
      return response.json();
    };
    const selected = await findImageRun(revision, get);
    output({
      revision,
      "run-id": selected.runId,
      "run-attempt": selected.runAttempt,
      "artifact-id": selected.artifactId,
    });
  } else if (mode === "verify") {
    const path = process.argv[3];
    const stat = fs.lstatSync(path);
    ensure(
      stat.isFile() && !stat.isSymbolicLink() && stat.size <= 16384,
      "Arquivo de manifesto inválido",
    );
    const manifest = verifyManifest(JSON.parse(fs.readFileSync(path, "utf8")), {
      revision: process.env.EXPECTED_REVISION,
      runId: Number(process.env.EXPECTED_RUN_ID),
      runAttempt: Number(process.env.EXPECTED_RUN_ATTEMPT),
    });
    output({ digest: manifest.digest });
    console.log(
      "Imagem validada no CI " +
        manifest.runId +
        ": " +
        manifest.image +
        "@" +
        manifest.digest,
    );
  } else throw new Error("Operação inválida");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
