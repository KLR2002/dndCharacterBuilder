import type { Quat } from "../../rules/diceMath.ts";
import { projectDie, solidStyle, type ProjectedLabel } from "../../rules/diceProjection.ts";
import type { DieGeometry } from "../../rules/diceSolids.ts";

/** One solid die drawn on a 2D canvas: its geometry, orientation, colours, and where and how large it is. */
export type CanvasSolid = {
  geo: DieGeometry;
  pose: Quat;
  accent: { primary: string; text: string };
  dropped: boolean;
  /** The circumradius in CSS pixels. */
  size: number;
  /** The centre in the canvas's CSS pixels. */
  x: number;
  y: number;
};

/**
 * Draws a solid die with flat shading, outlines, numerals and pips. Faces turned away from the viewer are
 * not drawn. The context's transform is restored before the function returns.
 */
export function drawDie(ctx: CanvasRenderingContext2D, die: CanvasSolid): void {
  const drawn = projectDie(die.geo, die.pose, die.size, solidStyle(die.accent, die.dropped));
  ctx.save();
  ctx.translate(die.x, die.y);
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, die.size * 0.035);
  for (const face of drawn.faces) {
    if (!face.visible) continue;
    ctx.beginPath();
    face.corners.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = face.fill;
    ctx.fill();
    ctx.strokeStyle = face.stroke;
    ctx.stroke();
    for (const label of face.labels) drawLabel(ctx, label);
  }
  ctx.restore();
}

/** A pill of width `w` and height `h` centred on (cx, cy): the round-ended shadow under a die. */
export function fillPill(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const r = h / 2;
  const left = cx - w / 2 + r;
  const right = cx + w / 2 - r;
  ctx.beginPath();
  ctx.moveTo(left, cy - r);
  ctx.lineTo(right, cy - r);
  ctx.arc(right, cy, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(left, cy + r);
  ctx.arc(left, cy, r, Math.PI / 2, -Math.PI / 2, true);
  ctx.closePath();
  ctx.fill();
}

/** A label is drawn in its face's own units: the matrix maps them onto the die. */
function drawLabel(ctx: CanvasRenderingContext2D, label: ProjectedLabel): void {
  ctx.save();
  ctx.transform(...label.transform);
  ctx.fillStyle = label.fill;
  if (label.kind === "pips") {
    ctx.beginPath();
    for (const pip of label.pips) {
      ctx.moveTo(pip.cx + pip.r, pip.cy);
      ctx.arc(pip.cx, pip.cy, pip.r, 0, Math.PI * 2);
    }
    ctx.fill();
  } else {
    ctx.font = `800 ${label.fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label.text, 0, 0.35 * label.fontSize);
  }
  ctx.restore();
}
