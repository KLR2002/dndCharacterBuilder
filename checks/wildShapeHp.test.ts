import { test } from "node:test";
import assert from "node:assert/strict";
import {
  damageWildShape,
  enterWildShape,
  healWildShape,
  revertWildShape,
  setWildShapeHp,
  setWildShapeTempHp,
} from "../src/rules/wildShapeHp.ts";

const bear = (currentHp: number) => ({ name: "Black Bear", source: "SRD", ac: 11, currentHp, maxHp: 19 });
const wolf = { name: "Wolf", source: "SRD", ac: 13, currentHp: 11, maxHp: 11 };
const DEATH_SAVES_CLEARED = { successes: 0, failures: 0 } as const;
/** A character wearing a form. `tempHp` is the character's own normal temp HP. */
const wearing = (shape: object | null, tempHp = 0) => ({ currentHp: 20, tempHp, activeWildShape: shape });

test("damageWildShape: damage below beast HP only lowers the beast HP", () => {
  const character = { currentHp: 20, tempHp: 3, activeWildShape: bear(10) };
  assert.deepEqual(damageWildShape(character, 4), { activeWildShape: { ...bear(10), currentHp: 6 } });
});

test("damageWildShape: damage exactly equal to beast HP ends the form with no carry-over", () => {
  const character = { currentHp: 20, tempHp: 3, activeWildShape: bear(6) };
  assert.deepEqual(damageWildShape(character, 6), { activeWildShape: null });
});

test("damageWildShape: excess carries over to normal HP after temp HP absorbs first", () => {
  const character = { currentHp: 20, tempHp: 3, activeWildShape: bear(5) };
  // 9 damage: 5 ends the form, 4 carries over; temp HP takes 3, so 1 comes off current HP.
  assert.deepEqual(damageWildShape(character, 9), {
    activeWildShape: null,
    currentHp: 19,
    tempHp: 0,
    deathSaves: DEATH_SAVES_CLEARED,
  });
});

test("damageWildShape: excess that takes normal HP to 0 leaves death saves alone", () => {
  const character = { currentHp: 3, tempHp: 0, activeWildShape: bear(2) };
  assert.deepEqual(damageWildShape(character, 7), { activeWildShape: null, currentHp: 0, tempHp: 0 });
});

test("damageWildShape: excess that leaves normal HP above 0 clears death saves", () => {
  const character = { currentHp: 8, tempHp: 0, activeWildShape: bear(4) };
  assert.deepEqual(damageWildShape(character, 6), {
    activeWildShape: null,
    currentHp: 6,
    tempHp: 0,
    deathSaves: DEATH_SAVES_CLEARED,
  });
});

test("damageWildShape: a non-finite or negative amount changes nothing", () => {
  const character = { currentHp: 20, tempHp: 3, activeWildShape: bear(10) };
  assert.deepEqual(damageWildShape(character, Number.NaN), {});
  assert.deepEqual(damageWildShape(character, -2), {});
});

test("damageWildShape: the form's temp HP absorbs damage before the form's HP", () => {
  const character = wearing({ ...bear(10), tempHp: 4 });
  assert.deepEqual(damageWildShape(character, 3), { activeWildShape: { ...bear(10), currentHp: 10, tempHp: 1 } });
});

test("damageWildShape: form temp HP partly absorbs, then the rest comes off the form's HP", () => {
  const character = wearing({ ...bear(10), tempHp: 3 });
  assert.deepEqual(damageWildShape(character, 5), { activeWildShape: { ...bear(10), currentHp: 8, tempHp: 0 } });
});

test("damageWildShape: damage equal to the form's temp HP plus HP ends the form with no carry-over", () => {
  const character = wearing({ ...bear(6), tempHp: 4 });
  assert.deepEqual(damageWildShape(character, 10), { activeWildShape: null });
});

test("damageWildShape: excess after the form's temp HP and HP carries over to normal temp, then normal HP", () => {
  // Form: 2 temp, 5 HP. 9 damage: temp 2 and HP 5 are used up, 2 carries over.
  // Normal temp HP 3 absorbs the 2, so normal current HP stays at 20 and normal temp drops to 1.
  const character = wearing({ ...bear(5), tempHp: 2 }, 3);
  assert.deepEqual(damageWildShape(character, 9), {
    activeWildShape: null,
    currentHp: 20,
    tempHp: 1,
    deathSaves: DEATH_SAVES_CLEARED,
  });
});

test("damageWildShape: a form that drops does not return its temp HP to the character", () => {
  // The form's 3 temp HP is spent on the hit before the form ends, so nothing comes back.
  const character = { currentHp: 8, tempHp: 0, activeWildShape: { ...bear(4), tempHp: 3 } };
  assert.deepEqual(damageWildShape(character, 9), {
    activeWildShape: null,
    currentHp: 6,
    tempHp: 0,
    deathSaves: DEATH_SAVES_CLEARED,
  });
});

test("damageWildShape: a legacy form without temp HP takes damage as before", () => {
  const character = wearing(bear(10), 5);
  assert.deepEqual(damageWildShape(character, 4), { activeWildShape: { ...bear(10), currentHp: 6 } });
});

test("healWildShape: heal is capped at the beast max HP", () => {
  assert.deepEqual(healWildShape(bear(15), 10), { activeWildShape: { ...bear(15), currentHp: 19 } });
});

test("healWildShape: heal adds to beast HP and returns only the form", () => {
  assert.deepEqual(healWildShape(bear(4), 5), { activeWildShape: { ...bear(4), currentHp: 9 } });
});

test("healWildShape: heal leaves the form's temp HP alone", () => {
  assert.deepEqual(healWildShape({ ...bear(4), tempHp: 3 }, 5), {
    activeWildShape: { ...bear(4), currentHp: 9, tempHp: 3 },
  });
});

test("healWildShape: a non-finite amount changes nothing", () => {
  assert.deepEqual(healWildShape(bear(4), Number.POSITIVE_INFINITY), {});
});

test("setWildShapeHp: sets the beast total and keeps the form", () => {
  assert.deepEqual(setWildShapeHp(wearing(bear(10)), 7), { activeWildShape: { ...bear(10), currentHp: 7 } });
});

test("setWildShapeHp: a total above max clamps to max", () => {
  assert.deepEqual(setWildShapeHp(wearing(bear(10)), 99), { activeWildShape: { ...bear(10), currentHp: 19 } });
});

test("setWildShapeHp: a fractional total rounds down", () => {
  assert.deepEqual(setWildShapeHp(wearing(bear(10)), 7.9), { activeWildShape: { ...bear(10), currentHp: 7 } });
});

test("setWildShapeHp: setting a positive total keeps the form's temp HP", () => {
  assert.deepEqual(setWildShapeHp(wearing({ ...bear(10), tempHp: 3 }), 7), {
    activeWildShape: { ...bear(10), currentHp: 7, tempHp: 3 },
  });
});

test("setWildShapeHp: a total of 0 ends the form with no carry-over", () => {
  assert.deepEqual(setWildShapeHp(wearing(bear(10)), 0), { activeWildShape: null });
});

test("setWildShapeHp: a total of 0 is a drop, so the form's temp HP is lost and the character's is unchanged", () => {
  const patch = setWildShapeHp(wearing({ ...bear(10), tempHp: 3 }, 2), 0);
  assert.deepEqual(patch, { activeWildShape: null });
  assert.equal("tempHp" in patch, false, "the character's temp HP is not returned or changed");
});

test("setWildShapeHp: a total of 0 does not return the form's temp HP even when the character has none", () => {
  assert.deepEqual(setWildShapeHp(wearing({ ...bear(10), tempHp: 4 }, 0), 0), { activeWildShape: null });
});

test("setWildShapeHp: a legacy form without temp HP ends with no temp change", () => {
  assert.deepEqual(setWildShapeHp(wearing(bear(10), 2), 0), { activeWildShape: null });
});

test("setWildShapeHp: a negative total clamps to 0 and ends the form, with no temp change", () => {
  assert.deepEqual(setWildShapeHp(wearing({ ...bear(10), tempHp: 2 }), -5), { activeWildShape: null });
});

test("setWildShapeHp: a non-finite total changes nothing", () => {
  assert.deepEqual(setWildShapeHp(wearing(bear(10)), Number.NaN), {});
  assert.deepEqual(setWildShapeHp(wearing(bear(10)), Number.POSITIVE_INFINITY), {});
});

test("revertWildShape: voluntary revert moves the form's temp HP back to the character", () => {
  const character = wearing({ ...bear(8), tempHp: 4 });
  assert.deepEqual(revertWildShape(character), { activeWildShape: null, tempHp: 4 });
});

test("revertWildShape: revert takes the larger of the form's and the character's temp HP (no stacking)", () => {
  assert.deepEqual(revertWildShape(wearing({ ...bear(8), tempHp: 4 }, 3)), { activeWildShape: null, tempHp: 4 });
  assert.deepEqual(revertWildShape(wearing({ ...bear(8), tempHp: 4 }, 6)), { activeWildShape: null, tempHp: 6 });
});

test("revertWildShape: a legacy form without temp HP leaves the character's temp HP as it is", () => {
  assert.deepEqual(revertWildShape(wearing(bear(8), 2)), { activeWildShape: null, tempHp: 2 });
});

test("revertWildShape: with no form active it changes nothing", () => {
  assert.deepEqual(revertWildShape(wearing(null, 2)), {});
});

test("enterWildShape: a fresh adoption moves the character's temp HP onto the form and zeroes the character's", () => {
  assert.deepEqual(enterWildShape(wearing(null, 5), wolf), {
    activeWildShape: { ...wolf, tempHp: 5 },
    tempHp: 0,
  });
});

test("enterWildShape: a fresh adoption with no temp HP puts 0 on the form", () => {
  assert.deepEqual(enterWildShape(wearing(null, 0), wolf), {
    activeWildShape: { ...wolf, tempHp: 0 },
    tempHp: 0,
  });
});

test("enterWildShape: replacing an active form keeps the old form's temp HP on the new form", () => {
  const character = wearing({ ...bear(8), tempHp: 4 }, 2);
  const patch = enterWildShape(character, wolf);
  assert.deepEqual(patch, { activeWildShape: { ...wolf, tempHp: 4 } });
  assert.equal("tempHp" in patch, false, "the character's normal temp HP is not touched");
});

test("enterWildShape: replacing a legacy form (no temp HP) gives the new form 0 temp HP", () => {
  assert.deepEqual(enterWildShape(wearing(bear(8), 2), wolf), { activeWildShape: { ...wolf, tempHp: 0 } });
});

test("setWildShapeTempHp: sets the form's temp HP, replacing rather than stacking", () => {
  assert.deepEqual(setWildShapeTempHp(wearing({ ...bear(10), tempHp: 2 }), 5), {
    activeWildShape: { ...bear(10), tempHp: 5 },
  });
});

test("setWildShapeTempHp: 0 clears the form's temp HP", () => {
  assert.deepEqual(setWildShapeTempHp(wearing({ ...bear(10), tempHp: 2 }), 0), {
    activeWildShape: { ...bear(10), tempHp: 0 },
  });
});

test("setWildShapeTempHp: a negative or non-finite value leaves the form unchanged", () => {
  const character = wearing({ ...bear(10), tempHp: 2 });
  assert.deepEqual(setWildShapeTempHp(character, -1), {});
  assert.deepEqual(setWildShapeTempHp(character, Number.NaN), {});
});

test("setWildShapeTempHp: with no form active it changes nothing", () => {
  assert.deepEqual(setWildShapeTempHp(wearing(null, 2), 5), {});
});
