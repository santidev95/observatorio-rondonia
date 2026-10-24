import assert from "node:assert/strict";
import { test } from "node:test";
import {
  portalColorSchemes,
  portalPalette,
  portalTokens,
} from "../src/theme/tokens";

function luminance(hex: string) {
  const values = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => Number.parseInt(part, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("tema Mantine: texto e foco conservam contraste no fundo e nos cartões", () => {
  for (const background of [portalTokens.paper, portalTokens.surface]) {
    for (const foreground of [
      portalTokens.ink,
      portalTokens.muted,
      portalTokens.dim,
      portalPalette.brand[3],
      portalPalette.brand[6],
    ])
      assert.ok(
        contrast(foreground, background) >= 4.5,
        `${foreground} deve permanecer legível sobre ${background}`,
      );
    assert.ok(contrast(portalPalette.brand[6], background) >= 3);
  }
  assert.ok(contrast(portalTokens.deep, portalPalette.brand[6]) >= 4.5);
});

for (const [name, tokens] of Object.entries(portalColorSchemes)) {
  test(`tema ${name}: textos, avisos e controles permanecem legíveis`, () => {
    for (const background of [
      tokens.paper,
      tokens.surface,
      tokens.surfaceSoft,
      tokens.surfaceRaised,
      tokens.deep,
    ]) {
      for (const foreground of [
        tokens.ink,
        tokens.muted,
        tokens.dim,
        tokens.gold,
        tokens.goldSoft,
        tokens.errorColor,
      ])
        assert.ok(
          contrast(foreground, background) >= 4.5,
          `${name}: ${foreground} deve ser legível sobre ${background}`,
        );
      assert.ok(contrast(tokens.gold, background) >= 3);
    }
    assert.ok(contrast(tokens.fieldBorder, tokens.deep) >= 3);
    assert.ok(contrast("#232323", portalPalette.brand[6]) >= 4.5);
  });
}
