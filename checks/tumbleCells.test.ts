import { test } from "node:test";
import assert from "node:assert/strict";
import { CELL, tumbleCells, tumbleHeight } from "../src/components/dice/tumbleCells.ts";

test("the dice wrap into rows of 72dp cells with a 6dp gap, filling each row from the left", () => {
  const cells = tumbleCells(11, 361);
  assert.equal(cells.length, 11);
  assert.ok(cells.every((cell) => cell.x >= 0 && cell.x + CELL <= 361), "a cell sticks out of the row");
  assert.equal(cells[0].x, 0);
  assert.equal(new Set(cells.map((cell) => cell.y)).size, 3, "11 dice in 361dp take three rows of four");
  cells.forEach((cell, i) => {
    if (i === 0) return;
    const previous = cells[i - 1];
    assert.ok(cell.y > previous.y || cell.x > previous.x, "cells are not in Roll order");
  });
});

test("the canvas is tall enough for every row and its lift", () => {
  assert.equal(tumbleHeight(0, 361), 0);
  // Three rows of 72dp with two 6dp gaps, below the 12dp top margin.
  assert.equal(tumbleHeight(11, 361), 12 + 3 * 72 + 2 * 6);
});

test("an unmeasured row has one column", () => {
  assert.equal(new Set(tumbleCells(3, 0).map((cell) => cell.x)).size, 1);
});
