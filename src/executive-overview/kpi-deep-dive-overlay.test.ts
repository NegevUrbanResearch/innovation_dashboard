import assert from "node:assert/strict";
import test from "node:test";

import { buildOverlayMotionDefinition } from "./overlay-motion.ts";

test("buildOverlayMotionDefinition falls back to the shared overlay entrance when origin is unavailable", () => {
  const motion = buildOverlayMotionDefinition(null, {
    left: 24,
    top: 24,
    width: 960,
    height: 640,
  });

  assert.deepEqual(motion.backdropOpacity, [0, 1]);
  assert.deepEqual(motion.shellOpacity, [0, 1]);
  assert.equal(
    motion.shellTransform[0],
    "translate3d(0, 18px, 0) scale(0.985) rotateX(-4deg)",
  );
  assert.equal(motion.shellTransformOrigin, "50% 0%");
});

test("buildOverlayMotionDefinition anchors overlay growth to the card origin rect", () => {
  const motion = buildOverlayMotionDefinition(
    {
      left: 100,
      top: 180,
      width: 214,
      height: 155,
    },
    {
      left: 40,
      top: 40,
      width: 1080,
      height: 720,
    },
  );

  assert.deepEqual(motion.backdropOpacity, [0, 1]);
  assert.deepEqual(motion.shellOpacity, [0.44, 1]);
  assert.match(
    motion.shellTransform[0],
    /translate3d\(-373px, -142\.5px, 0\) scale\(0\.198, 0\.215\) rotateX\(-11\.226deg\)/,
  );
  assert.equal(motion.shellTransform[1], "translate3d(0, 0, 0) scale(1) rotateX(0deg)");
  assert.equal(motion.shellTransformOrigin, "15.463% 28%");
});
