import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMotionPhaseKeyframes,
  formatTopLeftRectTransform,
  lerpRect,
  topLeftRectMotion,
} from "./overlay-motion.ts";
const fromRect = { left: 100, top: 180, width: 214, height: 155 };
const toRect = { left: 40, top: 40, width: 1080, height: 720 };
const shellRect = { left: 40, top: 40, width: 1080, height: 720 };

for (const progress of [0, 0.5, 1]) {
  test(`ghost transform and fixed shell scale produce aligned visual width at progress ${progress}`, () => {
    const currentRect = lerpRect(fromRect, toRect, progress);
    const ghostScaleX = currentRect.width / fromRect.width;
    const innerShellScaleX = fromRect.width / shellRect.width;
    const visualWidth = ghostScaleX * shellRect.width * innerShellScaleX;

    assert.equal(visualWidth, currentRect.width);
  });
}

for (const progress of [0, 0.5, 1]) {
  test(`close ghost transform and unit shell scale produce aligned visual width at progress ${progress}`, () => {
    const currentRect = lerpRect(toRect, fromRect, progress);
    const ghostScaleX = currentRect.width / toRect.width;
    const innerShellScaleX = 1;
    const visualWidth = ghostScaleX * shellRect.width * innerShellScaleX;

    assert.equal(visualWidth, currentRect.width);
  });
}

test("lerpRect returns endpoints at progress 0 and 1", () => {
  const start = lerpRect(fromRect, toRect, 0);
  assert.equal(start.left, fromRect.left);
  assert.equal(start.top, fromRect.top);
  assert.equal(start.width, fromRect.width);
  assert.equal(start.height, fromRect.height);

  const end = lerpRect(fromRect, toRect, 1);
  assert.equal(end.left, toRect.left);
  assert.equal(end.top, toRect.top);
  assert.equal(end.width, toRect.width);
  assert.equal(end.height, toRect.height);
});

test("lerpRect returns midpoint at progress 0.5", () => {
  const mid = lerpRect(fromRect, toRect, 0.5);

  assert.equal(mid.left, (fromRect.left + toRect.left) / 2);
  assert.equal(mid.top, (fromRect.top + toRect.top) / 2);
  assert.equal(mid.width, (fromRect.width + toRect.width) / 2);
  assert.equal(mid.height, (fromRect.height + toRect.height) / 2);
});

test("topLeftRectMotion is identity when anchor matches visual rect", () => {
  const motion = topLeftRectMotion(fromRect, fromRect);
  assert.equal(motion.translateX, 0);
  assert.equal(motion.translateY, 0);
  assert.equal(motion.scaleX, 1);
  assert.equal(motion.scaleY, 1);
});

test("open travel ends at top-left transform from card anchor to overlay", () => {
  const originRect = { ...fromRect };
  const targetRect = { ...toRect };
  const phases = buildMotionPhaseKeyframes(
    originRect as DOMRect,
    targetRect as DOMRect,
    "open",
  );

  assert.equal(phases.travel.transform[0], "translate3d(0, 0, 0) scale(1)");
  assert.equal(
    phases.travel.transform[1],
    formatTopLeftRectTransform(originRect, targetRect),
  );
});

test("close travel ends at top-left transform from overlay anchor to card", () => {
  const originRect = { ...fromRect };
  const targetRect = { ...toRect };
  const phases = buildMotionPhaseKeyframes(
    originRect as DOMRect,
    targetRect as DOMRect,
    "close",
  );

  assert.equal(phases.travel.transform[0], "translate3d(0, 0, 0) scale(1)");
  assert.equal(
    phases.travel.transform[1],
    formatTopLeftRectTransform(targetRect, originRect),
  );
});