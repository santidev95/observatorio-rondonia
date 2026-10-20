import { build } from "esbuild";
await build({
  entryPoints: ["scripts/revenues-worker.ts"],
  outfile: "dist/revenues-worker.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: false,
});
