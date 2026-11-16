package expo.modules.dicecanvas

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/** A body's centre in px and its orientation (w, x, y, z), sampled from a recorded Throw. */
data class ThrowPose(val x: Double, val y: Double, val z: Double, val q: DoubleArray)

data class PipMark(val cx: Double, val cy: Double, val r: Double)

data class FaceShading(val shade: Double, val alpha: Double)

/** Frames per second of the recorded Throw motion. Matches THROW_FPS in src/rules/diceThrow.ts. */
internal const val THROW_FPS = 60.0

/** Numbers per sampled Throw pose: x, y, height, then the orientation quaternion (w, x, y, z). */
internal const val POSE_SIZE = 7

private val LIGHT = doubleArrayOf(-0.35, 0.5, 0.8).let { a ->
  val l = hypot(hypot(a[0], a[1]), a[2])
  doubleArrayOf(a[0] / l, a[1] / l, a[2] / l)
}

/** Rotates the vector `v` by the unit quaternion `q` (w, x, y, z) and writes it to `out` from index `at`. Allocates nothing. */
fun rotateVectorInto(q: DoubleArray, v: DoubleArray, out: DoubleArray, at: Int = 0) {
  val w = q[0]
  val ux = q[1]
  val uy = q[2]
  val uz = q[3]
  val vx = v[0]
  val vy = v[1]
  val vz = v[2]
  // t = 2 (u x v)
  val tx = 2.0 * (uy * vz - uz * vy)
  val ty = 2.0 * (uz * vx - ux * vz)
  val tz = 2.0 * (ux * vy - uy * vx)
  // v + w t + u x t
  out[at] = vx + w * tx + (uy * tz - uz * ty)
  out[at + 1] = vy + w * ty + (uz * tx - ux * tz)
  out[at + 2] = vz + w * tz + (ux * ty - uy * tx)
}

/** Rotates the vector `v` by the unit quaternion `q` (w, x, y, z). */
fun rotateVector(q: DoubleArray, v: DoubleArray): DoubleArray = DoubleArray(3).also { rotateVectorInto(q, v, it) }

fun quatMultiply(a: DoubleArray, b: DoubleArray): DoubleArray = doubleArrayOf(
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
)

fun quatFromAxisAngle(axis: DoubleArray, angle: Double): DoubleArray {
  val l = hypot(hypot(axis[0], axis[1]), axis[2]).let { if (it == 0.0) 1.0 else it }
  val s = sin(angle / 2.0)
  return doubleArrayOf(cos(angle / 2.0), axis[0] / l * s, axis[1] / l * s, axis[2] / l * s)
}

/**
 * The pose of one body `seconds` into a recorded Throw, written to `out` from index `at` as POSE_SIZE numbers.
 * `frames` holds POSE_SIZE numbers per frame. The two frames around that time are blended linearly and the
 * orientation normalised; times outside the recording give the first or last frame. Allocates nothing.
 */
fun sampleThrowInto(frames: DoubleArray, frameCount: Int, seconds: Double, out: DoubleArray, at: Int) {
  val last = frameCount - 1
  val f = min(last.toDouble(), max(0.0, seconds * THROW_FPS))
  val i0 = floor(f).toInt()
  val i1 = min(i0 + 1, last)
  val t = f - i0
  val a = i0 * POSE_SIZE
  val b = i1 * POSE_SIZE
  for (j in 0 until 3) out[at + j] = frames[a + j] + (frames[b + j] - frames[a + j]) * t
  // Normalised linear interpolation of the orientations, the shorter way round.
  var d = 0.0
  for (j in 3 until POSE_SIZE) d += frames[a + j] * frames[b + j]
  val sign = if (d < 0.0) -1.0 else 1.0
  var sum = 0.0
  for (j in 3 until POSE_SIZE) {
    val v = frames[a + j] * (1.0 - t) + sign * frames[b + j] * t
    out[at + j] = v
    sum += v * v
  }
  val l = sqrt(sum).let { if (it == 0.0) 1.0 else it }
  for (j in 3 until POSE_SIZE) out[at + j] /= l
}

/** The pose of one body `seconds` into a recorded Throw. See sampleThrowInto. */
fun sampleThrow(frames: DoubleArray, frameCount: Int, seconds: Double): ThrowPose {
  val out = DoubleArray(POSE_SIZE)
  sampleThrowInto(frames, frameCount, seconds, out, 0)
  return ThrowPose(out[0], out[1], out[2], out.copyOfRange(3, POSE_SIZE))
}

/**
 * The orientation of a tumbling die at `progress` (0 to 1), written to `out`: it turns about `axis` and
 * reaches `target` at 1. Allocates nothing.
 */
fun tumbleQuaternionInto(target: DoubleArray, axis: DoubleArray, spin: Double, progress: Double, out: DoubleArray) {
  val eased = 1.0 - (1.0 - progress).pow(3)
  val half = spin * (1.0 - eased) / 2.0
  val s = sin(half)
  val l = hypot(hypot(axis[0], axis[1]), axis[2]).let { if (it == 0.0) 1.0 else it }
  // The turn r = (cos, n sin), and out = target * r.
  val rw = cos(half)
  val rx = axis[0] / l * s
  val ry = axis[1] / l * s
  val rz = axis[2] / l * s
  val aw = target[0]
  val ax = target[1]
  val ay = target[2]
  val az = target[3]
  out[0] = aw * rw - ax * rx - ay * ry - az * rz
  out[1] = aw * rx + ax * rw + ay * rz - az * ry
  out[2] = aw * ry - ax * rz + ay * rw + az * rx
  out[3] = aw * rz + ax * ry - ay * rx + az * rw
}

/** The orientation of a tumbling die at `progress` (0 to 1). See tumbleQuaternionInto. */
fun tumbleQuaternion(target: DoubleArray, axis: DoubleArray, spin: Double, progress: Double): DoubleArray =
  DoubleArray(4).also { tumbleQuaternionInto(target, axis, spin, progress, it) }

/** The lift of a tumbling die: 0 at rest, 1 at its highest point, back to 0 when it lands. */
fun tumblePop(progress: Double): Double = sin(PI * min(1.0, progress * 1.15))

/** Pip cells of each d6 value, as (x, y) pairs in units of the half-gap; index 0 is unused. */
private val PIP_CELLS: Array<IntArray> = arrayOf(
  intArrayOf(),
  intArrayOf(0, 0),
  intArrayOf(-1, -1, 1, 1),
  intArrayOf(-1, -1, 0, 0, 1, 1),
  intArrayOf(-1, -1, 1, -1, -1, 1, 1, 1),
  intArrayOf(-1, -1, 1, -1, 0, 0, -1, 1, 1, 1),
  intArrayOf(-1, -1, 1, -1, -1, 0, 1, 0, -1, 1, 1, 1),
)

/**
 * Writes the pip centres of a d6 face showing `value` to `out`, three numbers per pip (cx, cy, r), for a face
 * of half-size `halfSize`. Returns the number of pips. Allocates nothing; `out` needs 18 numbers.
 */
fun pipMarksInto(value: Int, halfSize: Double, out: DoubleArray): Int {
  val cells = PIP_CELLS.getOrNull(value) ?: return 0
  val gap = halfSize * 0.5 * 100.0
  val radius = halfSize * 0.17 * 100.0
  var count = 0
  var i = 0
  while (i < cells.size) {
    out[count * 3] = cells[i] * gap
    out[count * 3 + 1] = cells[i + 1] * gap
    out[count * 3 + 2] = radius
    count++
    i += 2
  }
  return count
}

/** The pip centres of a d6 face showing `value`, for a face of half-size `halfSize`. */
fun pipMarks(value: Int, halfSize: Double): List<PipMark> {
  val out = DoubleArray(18)
  val count = pipMarksInto(value, halfSize, out)
  return List(count) { PipMark(out[it * 3], out[it * 3 + 1], out[it * 3 + 2]) }
}

/** The shade of a face whose screen-space normal is `n` (three numbers). */
fun faceShade(n: DoubleArray): Double = 0.3 + 0.7 * max(0.0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2])

/** The opacity of a face's ink, from the z of its screen-space normal. */
fun faceAlpha(normalZ: Double): Double = min(1.0, 0.6 + 0.4 * normalZ)

/** The shade and ink opacity of a face whose normal is `normal` in screen space. */
fun faceShading(normal: DoubleArray): FaceShading = FaceShading(faceShade(normal), faceAlpha(normal[2]))

/**
 * Writes the six numbers of a label's 2D affine matrix (a, b, c, d, e, f) to `out`: the label at `at` with
 * axes `right` and `up`, in the die's own frame, for the orientation `q` and a die of `size` pixels. Screen y
 * points down. `scratch` holds nine numbers of working space. Allocates nothing.
 */
fun labelMatrixInto(q: DoubleArray, at: DoubleArray, right: DoubleArray, up: DoubleArray, size: Double, out: DoubleArray, scratch: DoubleArray) {
  val labelScale = 0.01
  rotateVectorInto(q, at, scratch, 0)
  rotateVectorInto(q, right, scratch, 3)
  rotateVectorInto(q, up, scratch, 6)
  out[0] = scratch[3] * labelScale * size
  out[1] = -scratch[4] * labelScale * size
  out[2] = -scratch[6] * labelScale * size
  out[3] = scratch[7] * labelScale * size
  out[4] = scratch[0] * size
  out[5] = -scratch[1] * size
}

/** The label matrix of a label at `at`. See labelMatrixInto. */
fun labelMatrix(q: DoubleArray, at: DoubleArray, right: DoubleArray, up: DoubleArray, size: Double): DoubleArray =
  DoubleArray(6).also { labelMatrixInto(q, at, right, up, size, it, DoubleArray(9)) }
