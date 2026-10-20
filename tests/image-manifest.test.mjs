import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ARTIFACT,
  IMAGE,
  REPOSITORY,
  findImageRun,
  resolveRevision,
  trustedRun,
  verifyManifest,
} from "../scripts/ci/image-manifest.mjs";

const revision = "a".repeat(40);
const expected = { revision, runId: 123, runAttempt: 2 };
const manifest = {
  schemaVersion: 1,
  repository: REPOSITORY,
  revision,
  image: IMAGE,
  digest: "sha256:" + "b".repeat(64),
  runId: 123,
  runAttempt: 1,
};
const run = {
  id: 123,
  run_attempt: 2,
  repository: { full_name: REPOSITORY },
  head_repository: { full_name: REPOSITORY },
  head_sha: revision,
  head_branch: "master",
  path: ".github/workflows/ci.yml",
  event: "push",
  status: "completed",
  conclusion: "success",
};
const artifact = {
  id: 456,
  name: ARTIFACT,
  expired: false,
  size_in_bytes: 512,
  workflow_run: { id: 123, head_sha: revision },
};

test("manifesto liga um digest imutável ao commit e CI esperados", () => {
  assert.equal(verifyManifest(manifest, expected).digest, manifest.digest);
});
test("rejeita imagem, commit, repositório, CI ou tentativa divergentes", () => {
  for (const patch of [
    { image: IMAGE + "-outro" },
    { repository: "outro/projeto" },
    { revision: "c".repeat(40) },
    { runId: 999 },
    { runAttempt: 3 },
    { schemaVersion: 2 },
    { extra: true },
    { digest: "latest" },
    { digest: manifest.digest + "\nrevision=alterada" },
    { runId: "123" },
    { runAttempt: 0 },
  ])
    assert.throws(() => verifyManifest({ ...manifest, ...patch }, expected));
  for (const invalid of [null, [], "json", {}])
    assert.throws(() => verifyManifest(invalid, expected));
});
test("não confia em PR, fork, outra branch ou outro workflow", () => {
  assert.equal(trustedRun(run, revision), true);
  for (const patch of [
    { event: "pull_request" },
    { event: "pull_request_target" },
    { head_repository: { full_name: "fork/projeto" } },
    { repository: { full_name: "outro/projeto" } },
    { head_branch: "feature" },
    { path: ".github/workflows/outro.yml" },
    { head_sha: "d".repeat(40) },
    { run_attempt: 0 },
  ])
    assert.equal(trustedRun({ ...run, ...patch }, revision), false);
});
test("seleciona somente artefato pertencente ao CI aprovado", async () => {
  const paths = [];
  const result = await findImageRun(
    revision,
    async (path) => {
      paths.push(path);
      return path.includes("/artifacts?")
        ? { artifacts: [artifact] }
        : { workflow_runs: [run] };
    },
    { attempts: 1 },
  );
  assert.deepEqual(result, {
    revision,
    runId: 123,
    runAttempt: 2,
    artifactId: 456,
  });
  assert.equal(paths.length, 2);
});
test("CI de PR ou falho nunca libera consulta ao seu artefato", async () => {
  let calls = 0;
  await assert.rejects(
    findImageRun(
      revision,
      async () => {
        calls++;
        return {
          workflow_runs: [
            { ...run, event: "pull_request" },
            { ...run, conclusion: "failure" },
            { ...run, conclusion: "cancelled" },
          ],
        };
      },
      { attempts: 1 },
    ),
    /Não há manifesto/,
  );
  assert.equal(calls, 1);
});
test("artefato expirado, grande ou ligado a outra execução é recusado", async () => {
  for (const patch of [
    { expired: true },
    { size_in_bytes: 1000000 },
    { size_in_bytes: 0 },
    { name: "outro" },
    { workflow_run: { id: 999, head_sha: revision } },
    { workflow_run: { id: 123, head_sha: "e".repeat(40) } },
  ])
    await assert.rejects(
      findImageRun(
        revision,
        async (path) =>
          path.includes("/artifacts?")
            ? { artifacts: [{ ...artifact, ...patch }] }
            : { workflow_runs: [run] },
        { attempts: 1 },
      ),
      /Não há manifesto/,
    );
});
test("release pode aguardar o CI terminar sem construir outra imagem", async () => {
  let rounds = 0,
    pauses = 0;
  const result = await findImageRun(
    revision,
    async (path) => {
      if (path.includes("/artifacts?")) return { artifacts: [artifact] };
      rounds++;
      return {
        workflow_runs: [
          { ...run, status: rounds === 1 ? "in_progress" : "completed" },
        ],
      };
    },
    {
      attempts: 2,
      pause: async () => {
        pauses++;
      },
    },
  );
  assert.equal(result.artifactId, 456);
  assert.equal(pauses, 1);
});
test("falha da API não vira fallback para tag mutável ou rebuild", async () => {
  await assert.rejects(
    findImageRun(
      revision,
      async () => {
        throw new Error("HTTP 403");
      },
      { attempts: 1 },
    ),
    /403/,
  );
});
test("revisão deve existir e ser ancestral da master", () => {
  const calls = [];
  assert.equal(
    resolveRevision("v0.3.0", (args) => {
      calls.push(args);
      return revision;
    }),
    revision,
  );
  assert.deepEqual(calls[1], [
    "merge-base",
    "--is-ancestor",
    revision,
    "origin/master",
  ]);
  assert.throws(
    () =>
      resolveRevision("tag-inexistente", () => {
        throw new Error("referência ausente");
      }),
    /ausente/,
  );
  assert.throws(
    () =>
      resolveRevision("feature", (args) => {
        if (args[0] === "merge-base") throw new Error("fora da master");
        return revision;
      }),
    /fora da master/,
  );
});
test("referências não podem injetar shell ou opções no Git", () => {
  for (const ref of [
    "--help",
    "master; id",
    "$(id)",
    "master\n",
    "",
    undefined,
  ]) {
    assert.throws(
      () =>
        resolveRevision(ref, () => {
          assert.fail("Git não deveria executar");
        }),
      /Referência inválida/,
    );
  }
});
test("Node do CI corresponde ao runtime e aos estágios Docker", () => {
  const major = fs
    .readFileSync(new URL("../.node-version", import.meta.url), "utf8")
    .trim();
  const docker = fs.readFileSync(
    new URL("../Dockerfile", import.meta.url),
    "utf8",
  );
  const versions = [...docker.matchAll(/^FROM node:(\d+)-/gm)].map((m) => m[1]);
  assert.equal(versions.length, 3);
  assert.ok(versions.every((v) => v === major));
});
