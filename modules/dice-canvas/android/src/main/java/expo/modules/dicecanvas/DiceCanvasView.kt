package expo.modules.dicecanvas

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.view.Choreographer
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min

private class Label(
  val text: String?,
  val value: Int,
  val at: DoubleArray,
  val right: DoubleArray,
  val up: DoubleArray,
  val size: Double,
  val width: Float,
)

private class Face(val idx: IntArray, val normal: DoubleArray, val labels: List<Label>)

/** One solid body. Throw bodies carry `frames`; Tumble bodies carry the target, axis, spin and grid position. */
private class Body(
  val verts: Array<DoubleArray>,
  val faces: List<Face>,
  val base: DoubleArray,
  val ink: DoubleArray,
  val frames: DoubleArray,
  val rest: Double,
  val target: DoubleArray,
  val axis: DoubleArray,
  val spin: Double,
  val cx: Double,
  val cy: Double,
  val delay: Double,
)

private class Scene(
  val throwMode: Boolean,
  val size: Double,
  val frameCount: Int,
  val cell: Double,
  val bodies: List<Body>,
  val durationMs: Double,
)

/** Frames per second of the recorded Throw motion. */
private const val THROW_FPS = 60.0

/** How long one Tumble die turns, in milliseconds. */
private const val TUMBLE_MS = 950.0

/** Grey body and muted ink of a die that has been dropped from the roll. */
private val GREY_BODY = doubleArrayOf(104.0, 108.0, 116.0)
private val GREY_INK = doubleArrayOf(210.0, 210.0, 210.0)

private fun doubles(array: JSONArray): DoubleArray = DoubleArray(array.length()) { array.getDouble(it) }

private fun doubles(obj: JSONObject, key: String): DoubleArray = doubles(obj.getJSONArray(key))

/**
 * Draws the solid dice of one scene on a canvas. The scene arrives as JSON through `scene`, the dropped
 * dice as a string of 0 and 1 through `dropped`. The view runs its own frame clock from the moment a scene
 * is set; a change of `dropped` alone only redraws.
 */
class DiceCanvasView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var scene: Scene? = null
  private var dropped = BooleanArray(0)
  private var startNanos = 0L
  private var nowNanos = 0L
  private var running = false

  private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
  private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeJoin = Paint.Join.ROUND
  }
  private val inkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    textSize = 100f
    typeface = Typeface.create("sans-serif", Typeface.BOLD)
  }
  private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val path = Path()
  private val matrix = Matrix()
  private val matrixValues = FloatArray(9)
  private val oval = RectF()

  private val frameCallback = object : Choreographer.FrameCallback {
    override fun doFrame(frameTimeNanos: Long) {
      val s = scene ?: return
      if (startNanos == 0L) startNanos = frameTimeNanos
      nowNanos = frameTimeNanos
      invalidate()
      if ((nowNanos - startNanos) / 1e6 < s.durationMs) {
        Choreographer.getInstance().postFrameCallback(this)
      } else {
        running = false
      }
    }
  }

  init {
    setWillNotDraw(false)
  }

  fun setScene(json: String?) {
    scene = if (json == null) null else parse(json)
    startNanos = 0L
    nowNanos = 0L
    if (scene != null) start() else invalidate()
  }

  fun setDropped(flags: String?) {
    val text = flags.orEmpty()
    dropped = BooleanArray(text.length) { text[it] == '1' }
    invalidate()
  }

  private fun start() {
    if (running) Choreographer.getInstance().removeFrameCallback(frameCallback)
    running = true
    Choreographer.getInstance().postFrameCallback(frameCallback)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (scene != null && !running && startNanos == 0L) start()
  }

  override fun onDetachedFromWindow() {
    Choreographer.getInstance().removeFrameCallback(frameCallback)
    running = false
    super.onDetachedFromWindow()
  }

  private fun parse(json: String): Scene {
    val root = JSONObject(json)
    val throwMode = root.getString("mode") == "throw"
    val list = root.getJSONArray("bodies")
    val bodies = ArrayList<Body>(list.length())
    for (b in 0 until list.length()) {
      val o = list.getJSONObject(b)
      val vertsJson = o.getJSONArray("verts")
      val verts = Array(vertsJson.length()) { doubles(vertsJson.getJSONArray(it)) }
      val facesJson = o.getJSONArray("faces")
      val faces = ArrayList<Face>(facesJson.length())
      for (f in 0 until facesJson.length()) {
        val fo = facesJson.getJSONObject(f)
        val idxJson = fo.getJSONArray("idx")
        val labelsJson = fo.getJSONArray("labels")
        val labels = ArrayList<Label>(labelsJson.length())
        for (l in 0 until labelsJson.length()) {
          val lo = labelsJson.getJSONObject(l)
          val text = if (lo.has("text")) lo.getString("text") else null
          labels.add(
            Label(
              text,
              lo.optInt("value", 0),
              doubles(lo.getJSONArray("at")),
              doubles(lo.getJSONArray("right")),
              doubles(lo.getJSONArray("up")),
              lo.getDouble("size"),
              if (text != null) inkPaint.measureText(text) else 0f,
            ),
          )
        }
        faces.add(Face(IntArray(idxJson.length()) { idxJson.getInt(it) }, doubles(fo, "n"), labels))
      }
      bodies.add(
        Body(
          verts = verts,
          faces = faces,
          base = doubles(o, "base"),
          ink = doubles(o, "ink"),
          frames = if (o.has("frames")) doubles(o, "frames") else DoubleArray(0),
          rest = o.optDouble("rest", 0.0),
          target = if (o.has("target")) doubles(o, "target") else DoubleArray(4),
          axis = if (o.has("axis")) doubles(o, "axis") else DoubleArray(3),
          spin = o.optDouble("spin", 0.0),
          cx = o.optDouble("cx", 0.0),
          cy = o.optDouble("cy", 0.0),
          delay = o.optDouble("delay", 0.0),
        ),
      )
    }
    val frameCount = root.optInt("frameCount", 0)
    val cell = root.optDouble("cell", 72.0)
    val duration = if (throwMode) {
      frameCount / THROW_FPS * 1000.0 + 100.0
    } else {
      TUMBLE_MS + (bodies.maxOfOrNull { it.delay } ?: 0.0) + 100.0
    }
    return Scene(throwMode, root.getDouble("size"), frameCount, cell, bodies, duration)
  }

  override fun onDraw(canvas: Canvas) {
    val s = scene ?: return
    val density = resources.displayMetrics.density
    val ms = if (startNanos == 0L) 0.0 else (nowNanos - startNanos) / 1e6
    canvas.save()
    canvas.scale(density, density)
    if (s.throwMode) drawThrow(canvas, s, ms / 1000.0) else drawTumble(canvas, s, ms)
    canvas.restore()
  }

  private fun drawThrow(canvas: Canvas, s: Scene, seconds: Double) {
    val poses = s.bodies.map { sampleThrow(it.frames, s.frameCount, seconds) }
    for ((i, pose) in poses.withIndex()) {
      val lift = pose.z - s.bodies[i].rest
      shadowPaint.color = Color.argb((max(0.08, 0.34 - lift * 0.0014) * 255.0).toInt(), 0, 0, 0)
      val left = pose.x + 3.0 + lift * 0.16 - s.size * 0.85
      val top = pose.y + 6.0 + lift * 0.26 - s.size * 0.7
      oval.set(left.toFloat(), top.toFloat(), (left + s.size * 1.7).toFloat(), (top + s.size * 1.4).toFloat())
      canvas.drawOval(oval, shadowPaint)
    }
    // The lowest die is drawn first, so a die in the air covers the ones below it.
    for (i in poses.indices.sortedBy { poses[it].z }) {
      val pose = poses[i]
      val lift = pose.z - s.bodies[i].rest
      drawDie(
        canvas,
        s.bodies[i],
        pose.q,
        pose.x,
        pose.y,
        s.size * (1.0 + lift * 0.0023),
        dropped.getOrElse(i) { false },
      )
    }
  }

  private fun drawTumble(canvas: Canvas, s: Scene, ms: Double) {
    for ((i, body) in s.bodies.withIndex()) {
      val progress = min(1.0, max(0.0, (ms - body.delay) / TUMBLE_MS))
      val pop = tumblePop(progress)
      val shadowScale = 1.0 - 0.3 * pop
      val w = s.cell * 0.5 * shadowScale
      val h = 8.0 * shadowScale
      shadowPaint.color = Color.argb((0.35 * (1.0 - 0.6 * pop) * 255.0).toInt(), 0, 0, 0)
      val top = body.cy + s.cell / 2.0 - 6.0 - 4.0 - h / 2.0
      oval.set((body.cx - w / 2.0).toFloat(), top.toFloat(), (body.cx + w / 2.0).toFloat(), (top + h).toFloat())
      canvas.drawRoundRect(oval, (4.0 * shadowScale).toFloat(), (4.0 * shadowScale).toFloat(), shadowPaint)
      val q = tumbleQuaternion(body.target, body.axis, body.spin, progress)
      val grey = progress >= 1.0 && dropped.getOrElse(i) { false }
      drawDie(canvas, body, q, body.cx, body.cy - 8.0 * pop, s.cell * 0.36 * (1.0 + 0.22 * pop), grey)
    }
  }

  private fun drawDie(canvas: Canvas, body: Body, q: DoubleArray, cx: Double, cy: Double, size: Double, grey: Boolean) {
    val base = if (grey) GREY_BODY else body.base
    val ink = if (grey) GREY_INK else body.ink
    val rotated = Array(body.verts.size) { rotateVector(q, body.verts[it]) }
    stroke.strokeWidth = max(1.0, size * 0.035).toFloat()
    stroke.color = Color.argb(if (grey) 89 else 128, 0, 0, 0)
    for (face in body.faces) {
      val normal = rotateVector(q, face.normal)
      if (normal[2] <= 0.004) continue
      val shading = faceShading(normal)
      fill.color = Color.rgb(
        (base[0] * shading.shade).toInt(),
        (base[1] * shading.shade).toInt(),
        (base[2] * shading.shade).toInt(),
      )
      path.reset()
      for ((p, vi) in face.idx.withIndex()) {
        val x = cx + rotated[vi][0] * size
        val y = cy - rotated[vi][1] * size
        if (p == 0) path.moveTo(x.toFloat(), y.toFloat()) else path.lineTo(x.toFloat(), y.toFloat())
      }
      path.close()
      canvas.drawPath(path, fill)
      canvas.drawPath(path, stroke)

      inkPaint.color = Color.argb(
        (shading.alpha * 255.0).toInt(),
        ink[0].toInt(),
        ink[1].toInt(),
        ink[2].toInt(),
      )
      for (label in face.labels) {
        // labelMatrix gives SVG's (a, b, c, d, e, f); Android's Matrix takes (scaleX, skewX, transX, skewY, scaleY, transY).
        val m = labelMatrix(q, label.at, label.right, label.up, size)
        matrixValues[0] = m[0].toFloat()
        matrixValues[1] = m[2].toFloat()
        matrixValues[2] = (cx + m[4]).toFloat()
        matrixValues[3] = m[1].toFloat()
        matrixValues[4] = m[3].toFloat()
        matrixValues[5] = (cy + m[5]).toFloat()
        matrixValues[6] = 0f
        matrixValues[7] = 0f
        matrixValues[8] = 1f
        matrix.setValues(matrixValues)
        canvas.save()
        canvas.concat(matrix)
        val text = label.text
        if (text != null) {
          canvas.scale(label.size.toFloat(), label.size.toFloat())
          canvas.drawText(text, -label.width / 2f, 35f, inkPaint)
        } else {
          for (mark in pipMarks(label.value, label.size)) {
            canvas.drawCircle(mark.cx.toFloat(), mark.cy.toFloat(), mark.r.toFloat(), inkPaint)
          }
        }
        canvas.restore()
      }
    }
  }
}
