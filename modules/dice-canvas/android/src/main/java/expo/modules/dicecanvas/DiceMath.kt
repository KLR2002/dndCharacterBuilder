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
private const val THROW_FPS = 60.0

private val LIGHT = normalizeVec(doubleArrayOf(-0.35, 0.5, 0.8))

private fun normalizeVec(a: DoubleArray): DoubleArray {
  val l = hypot(hypot(a[0], a[1]), a[2]).let { if (it == 0.0) 1.0 else it }
  return doubleArrayOf(a[0] / l, a[1] / l, a[2] / l)
}

private fun normalizeQuat(q: DoubleArray): DoubleArray {
  val l = sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).let { if (it == 0.0) 1.0 else it }
  return doubleArrayOf(q[0] / l, q[1] / l, q[2] / l, q[3] / l)
}

private fun dot3(a: DoubleArray, b: DoubleArray) = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

private fun cross3(a: DoubleArray, b: DoubleArray) = doubleArrayOf(
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
)

/** Rotates the vector `v` by the unit quaternion `q` (w, x, y, z). */
fun rotateVector(q: DoubleArray, v: DoubleArray): DoubleArray {
  val u = doubleArrayOf(q[1], q[2], q[3])
  val t = cross3(u, v).map { 2.0 * it }.toDoubleArray()
  val ct = cross3(u, t)
  return doubleArrayOf(
    v[0] + q[0] * t[0] + ct[0],
    v[1] + q[0] * t[1] + ct[1],
    v[2] + q[0] * t[2] + ct[2],
  )
}

fun quatMultiply(a: DoubleArray, b: DoubleArray): DoubleArray = doubleArrayOf(
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
)

fun quatFromAxisAngle(axis: DoubleArray, angle: Double): DoubleArray {
  val n = normalizeVec(axis)
  val s = sin(angle / 2.0)
  return doubleArrayOf(cos(angle / 2.0), n[0] * s, n[1] * s, n[2] * s)
}

/**
 * The pose of one body `seconds` into a recorded Throw. `frames` holds seven numbers per frame
 * (x, y, height, qw, qx, qy, qz). The two frames around that time are blended linearly, the
 * orientation normalised; times outside the recording give the first or last frame.
 */
fun sampleThrow(frames: DoubleArray, frameCount: Int, seconds: Double): ThrowPose {
  val last = frameCount - 1
  val f = min(last.toDouble(), max(0.0, seconds * THROW_FPS))
  val i0 = floor(f).toInt()
  val i1 = min(i0 + 1, last)
  val t = f - i0
  val a = i0 * 7
  val b = i1 * 7
  fun lerp(j: Int) = frames[a + j] + (frames[b + j] - frames[a + j]) * t
  val qa = doubleArrayOf(frames[a + 3], frames[a + 4], frames[a + 5], frames[a + 6])
  val qb = doubleArrayOf(frames[b + 3], frames[b + 4], frames[b + 5], frames[b + 6])
  return ThrowPose(lerp(0), lerp(1), lerp(2), nlerp(qa, qb, t))
}

/** Normalised linear interpolation between two orientations, the shorter way round. */
private fun nlerp(a: DoubleArray, b: DoubleArray, t: Double): DoubleArray {
  val sign = if (dot4(a, b) < 0.0) -1.0 else 1.0
  return normalizeQuat(DoubleArray(4) { a[it] * (1.0 - t) + sign * b[it] * t })
}

private fun dot4(a: DoubleArray, b: DoubleArray) = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]

/** The orientation of a tumbling die at `progress` (0 to 1): it turns about `axis` and reaches `target` at 1. */
fun tumbleQuaternion(target: DoubleArray, axis: DoubleArray, spin: Double, progress: Double): DoubleArray {
  val eased = 1.0 - (1.0 - progress).pow(3)
  return quatMultiply(target, quatFromAxisAngle(axis, spin * (1.0 - eased)))
}

/** The lift of a tumbling die: 0 at rest, 1 at its highest point, back to 0 when it lands. */
fun tumblePop(progress: Double): Double = sin(PI * min(1.0, progress * 1.15))

private val PIP_CELLS: Map<Int, List<Pair<Int, Int>>> = mapOf(
  1 to listOf(0 to 0),
  2 to listOf(-1 to -1, 1 to 1),
  3 to listOf(-1 to -1, 0 to 0, 1 to 1),
  4 to listOf(-1 to -1, 1 to -1, -1 to 1, 1 to 1),
  5 to listOf(-1 to -1, 1 to -1, 0 to 0, -1 to 1, 1 to 1),
  6 to listOf(-1 to -1, 1 to -1, -1 to 0, 1 to 0, -1 to 1, 1 to 1),
)

/** The pip centres of a d6 face showing `value`, for a face of half-size `halfSize`. */
fun pipMarks(value: Int, halfSize: Double): List<PipMark> {
  val gap = halfSize * 0.5 * 100.0
  val radius = halfSize * 0.17 * 100.0
  return (PIP_CELLS[value] ?: emptyList()).map { (a, b) -> PipMark(a * gap, b * gap, radius) }
}

/** The shade and ink opacity of a face whose normal is `normal` in screen space. */
fun faceShading(normal: DoubleArray): FaceShading {
  val shade = 0.3 + 0.7 * max(0.0, dot3(normal, LIGHT))
  val alpha = min(1.0, 0.6 + 0.4 * normal[2])
  return FaceShading(shade, alpha)
}

/**
 * The label matrix (SVG `matrix(a b c d e f)`) of a label at `at` with axes `right` and `up`, in the die's
 * own frame, for the orientation `q` and a die of `size` pixels. Screen y points down.
 */
fun labelMatrix(q: DoubleArray, at: DoubleArray, right: DoubleArray, up: DoubleArray, size: Double): DoubleArray {
  val labelScale = 0.01
  val origin = rotateVector(q, at)
  val rightScreen = rotateVector(q, right)
  val upScreen = rotateVector(q, up)
  return doubleArrayOf(
    rightScreen[0] * labelScale * size,
    -rightScreen[1] * labelScale * size,
    -upScreen[0] * labelScale * size,
    upScreen[1] * labelScale * size,
    origin[0] * size,
    -origin[1] * size,
  )
}
