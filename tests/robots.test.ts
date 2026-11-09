import assert from "node:assert/strict";
import { test } from "node:test";
import robots from "../src/app/robots";

test("robots: bloqueia JSON e paginação de Despesas sem fechar o site", () => {
  assert.deepEqual(robots().rules, {
    userAgent: "*",
    allow: "/",
    disallow: ["/api/", "/*/despesas?"],
  });
});
