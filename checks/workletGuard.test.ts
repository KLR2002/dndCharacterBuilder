import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Reanimated compiles these functions for the UI thread, so each must start with the worklet directive or the animation fails on native.

const source = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

/** Whether the named function's body starts with the worklet directive. */
function startsWithWorklet(text: string, name: string): boolean {
  return new RegExp(`function ${name}\\([^)]*\\)[^{]*\\{\\s*'worklet';`).test(text);
}

test("every function in the projection module is a worklet", () => {
  const text = source("src/rules/diceProjection.ts");
  const names = [...text.matchAll(/^(?:export )?function (\w+)/gm)].map((match) => match[1]);
  assert.ok(names.length > 0, "the projection module declares functions");
  for (const name of names) assert.ok(startsWithWorklet(text, name), `${name} is not a worklet`);
});

test("the tumble and throw animation functions are worklets", () => {
  const animation = source("src/rules/diceAnimation.ts");
  for (const name of ["tumbleQuaternion", "tumblePop"]) {
    assert.ok(startsWithWorklet(animation, name), `${name} is not a worklet`);
  }
  assert.ok(startsWithWorklet(source("src/rules/diceThrow.ts"), "sampleThrow"), "sampleThrow is not a worklet");
});

test("the solid die passes its label matrix as a number array, as the matrix prop on native and transform on web", () => {
  const text = source("src/components/dice/SolidDie.tsx");
  assert.equal(/[`'"]matrix\(/.test(text), false, "a matrix string is in SolidDie");
  assert.match(text, /\.matrix = /, "native passes the matrix prop");
  assert.match(text, /\.transform = /, "web passes the transform prop");
});
