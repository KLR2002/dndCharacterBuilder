import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeLayout, BREAKPOINTS } from "../src/hooks/responsiveLayout.ts";

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

describe("BREAKPOINTS", () => {
  it("has correct threshold values", () => {
    assert.equal(BREAKPOINTS.compact, 380);
    assert.equal(BREAKPOINTS.phone, 600);
    assert.equal(BREAKPOINTS.tablet, 768);
  });
});

describe("computeLayout", () => {
  describe("compact breakpoint (< 380px)", () => {
    it("320px is compact", () => {
      const layout = computeLayout(320, 568, NO_INSETS);
      assert.equal(layout.isCompact, true);
      assert.equal(layout.isPhone, true);
      assert.equal(layout.isTablet, false);
    });

    it("360px is compact", () => {
      const layout = computeLayout(360, 640, NO_INSETS);
      assert.equal(layout.isCompact, true);
      assert.equal(layout.isPhone, true);
      assert.equal(layout.isTablet, false);
    });

    it("375px is compact", () => {
      const layout = computeLayout(375, 812, NO_INSETS);
      assert.equal(layout.isCompact, true);
      assert.equal(layout.isPhone, true);
      assert.equal(layout.isTablet, false);
    });

    it("379px is compact", () => {
      const layout = computeLayout(379, 800, NO_INSETS);
      assert.equal(layout.isCompact, true);
    });
  });

  describe("phone breakpoint (380–599px)", () => {
    it("380px is phone but not compact", () => {
      const layout = computeLayout(380, 800, NO_INSETS);
      assert.equal(layout.isCompact, false);
      assert.equal(layout.isPhone, true);
      assert.equal(layout.isTablet, false);
    });

    it("390px is phone but not compact", () => {
      const layout = computeLayout(390, 844, NO_INSETS);
      assert.equal(layout.isCompact, false);
      assert.equal(layout.isPhone, true);
      assert.equal(layout.isTablet, false);
    });

    it("414px is phone but not compact", () => {
      const layout = computeLayout(414, 896, NO_INSETS);
      assert.equal(layout.isCompact, false);
      assert.equal(layout.isPhone, true);
      assert.equal(layout.isTablet, false);
    });

    it("599px is still phone", () => {
      const layout = computeLayout(599, 1024, NO_INSETS);
      assert.equal(layout.isCompact, false);
      assert.equal(layout.isPhone, true);
      assert.equal(layout.isTablet, false);
    });
  });

  describe("mid-range (600–767px)", () => {
    it("600px is not phone, not tablet", () => {
      const layout = computeLayout(600, 1024, NO_INSETS);
      assert.equal(layout.isCompact, false);
      assert.equal(layout.isPhone, false);
      assert.equal(layout.isTablet, false);
    });

    it("767px is not phone, not tablet", () => {
      const layout = computeLayout(767, 1024, NO_INSETS);
      assert.equal(layout.isCompact, false);
      assert.equal(layout.isPhone, false);
      assert.equal(layout.isTablet, false);
    });
  });

  describe("tablet breakpoint (>= 768px)", () => {
    it("768px is tablet", () => {
      const layout = computeLayout(768, 1024, NO_INSETS);
      assert.equal(layout.isCompact, false);
      assert.equal(layout.isPhone, false);
      assert.equal(layout.isTablet, true);
    });

    it("1024px is tablet", () => {
      const layout = computeLayout(1024, 1366, NO_INSETS);
      assert.equal(layout.isCompact, false);
      assert.equal(layout.isPhone, false);
      assert.equal(layout.isTablet, true);
    });
  });

  describe("dimensions and content width", () => {
    it("returns correct width and height", () => {
      const layout = computeLayout(375, 812, NO_INSETS);
      assert.equal(layout.width, 375);
      assert.equal(layout.height, 812);
    });

    it("contentWidth equals width with zero insets", () => {
      const layout = computeLayout(414, 896, NO_INSETS);
      assert.equal(layout.contentWidth, 414);
    });

    it("contentWidth subtracts horizontal safe area insets", () => {
      const insets = { top: 47, bottom: 34, left: 16, right: 16 };
      const layout = computeLayout(414, 896, insets);
      assert.equal(layout.contentWidth, 414 - 16 - 16);
    });

    it("contentWidth cannot go negative", () => {
      const insets = { top: 0, bottom: 0, left: 200, right: 200 };
      const layout = computeLayout(300, 600, insets);
      assert.equal(layout.contentWidth, 0);
    });
  });

  describe("safe area insets passthrough", () => {
    it("passes insets through", () => {
      const insets = { top: 47, bottom: 34, left: 0, right: 0 };
      const layout = computeLayout(375, 812, insets);
      assert.deepEqual(layout.insets, insets);
    });

    it("defaults insets to zero when not provided", () => {
      const layout = computeLayout(375, 812);
      assert.deepEqual(layout.insets, NO_INSETS);
    });
  });

  describe("horizontalPadding", () => {
    it("returns 8 on compact screens", () => {
      const layout = computeLayout(320, 568, NO_INSETS);
      assert.equal(layout.horizontalPadding, 8);
    });

    it("returns 12 on phone screens", () => {
      const layout = computeLayout(414, 896, NO_INSETS);
      assert.equal(layout.horizontalPadding, 12);
    });

    it("returns 16 on tablet/desktop screens", () => {
      const layout = computeLayout(768, 1024, NO_INSETS);
      assert.equal(layout.horizontalPadding, 16);
    });

    it("returns 16 on mid-range (600-767px)", () => {
      const layout = computeLayout(600, 1024, NO_INSETS);
      assert.equal(layout.horizontalPadding, 16);
    });
  });
});
