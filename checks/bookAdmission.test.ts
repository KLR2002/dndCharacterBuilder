import test from "node:test";
import assert from "node:assert/strict";
import { admitsBook, isActiveBookRecord } from "../src/rules/bookAdmission.ts";
import { ALL_BOOKS, SRD_SOURCE } from "../src/constants/books.ts";

// Invented book codes throughout. The rule under test is ADR 0025's: sourceless and SRD records are always admitted,
// book codes compare without regard to case, ALL_BOOKS admits every book and an empty list admits none.

test("a source is admitted by the books that name it, in any case", () => {
  assert.equal(admitsBook(["TST"], "TST"), true);
  assert.equal(admitsBook(["tst"], "TST"), true);
  assert.equal(admitsBook(["MiXeD"], "mixed"), true);
  assert.equal(admitsBook(["OTH"], "TST"), false);
});

test("an empty book list admits no book", () => {
  assert.equal(admitsBook([], "TST"), false);
});

test("ALL_BOOKS admits every book", () => {
  assert.equal(admitsBook(ALL_BOOKS, "TST"), true);
});

test("a sourceless record and an SRD record are admitted whatever the books", () => {
  assert.equal(admitsBook([], undefined), true);
  assert.equal(admitsBook([], ""), true);
  assert.equal(admitsBook(["OTH"], SRD_SOURCE), true);
  assert.equal(admitsBook([], SRD_SOURCE), true);
});

test("an active book's record is one admitted and not SRD", () => {
  assert.equal(isActiveBookRecord(["tst"], "TST"), true);
  assert.equal(isActiveBookRecord(["TST"], SRD_SOURCE), false);
  assert.equal(isActiveBookRecord(["TST"], "OTH"), false);
  assert.equal(isActiveBookRecord(undefined, "TST"), false, "no book list means no active book");
});
