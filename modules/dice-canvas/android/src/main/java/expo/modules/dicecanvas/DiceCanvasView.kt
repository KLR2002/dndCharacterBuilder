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

/**
 * One solid body. Throw bodies carry `frames`; Tumble bodies carry the target, axis, spin and grid position.
 * `pose`, `q` and `rotated` are scratch space the view reuses every frame.
 */
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
) {
  val pose = DoubleArray(POSE_SIZE)
  val q = DoubleArray(4)
  val rotated = DoubleArray(verts.size * 3)
}

private class Scene(
  val throwMode: Boolean,
  val size: Double,
  val frameCount: Int,
  val cell: Double,
  val bodies: List<Body>,
  val durationMs: Double,
) {
  /** Body indexes in drawing order for a Throw, lowest first. */
  val order = IntArray(bodies.size)
}

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
  private var finished = false

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

  // Scratch space for one frame, reused so that drawing allocates nothing per frame.
  private val normal = DoubleArray(3)
  private val labelOut = DoubleArray(6)
  private val labelScratch = DoubleArray(9)
  private val pipOut = DoubleArray(18)

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
        finished = true
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
    finished = false
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
    // A detached view has dropped its frame callback; coming back resumes the clock unless the scene has finished.
    if (scene != null && !running && !finished) start()
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
    val count = s.bodies.size
    for (i in 0 until count) {
      val body = s.bodies[i]
      sampleThrowInto(body.frames, s.frameCount, seconds, body.pose, 0)
      body.pose.copyInto(body.q, 0, 3, POSE_SIZE)
      val lift = body.pose[2] - body.rest
      shadowPaint.color = Color.argb((max(0.08, 0.34 - lift * 0.0014) * 255.0).toInt(), 0, 0, 0)
      val left = body.pose[0] + 3.0 + lift * 0.16 - s.size * 0.85
      val top = body.pose[1] + 6.0 + lift * 0.26 - s.size * 0.7
      val height = s.size * 1.4
      oval.set(left.toFloat(), top.toFloat(), (left + s.size * 1.7).toFloat(), (top + height).toFloat())
      canvas.drawRoundRect(oval, (height / 2.0).toFloat(), (height / 2.0).toFloat(), shadowPaint)
    }
    // The lowest die is drawn first, so a die in the air covers the ones below it. Insertion sort on the
    // indexes: stable, so equal heights keep their Roll order, and no boxing.
    for (i in 0 until count) s.order[i] = i
    for (i in 1 until count) {
      val key = s.order[i]
      val keyZ = s.bodies[key].pose[2]
      var j = i - 1
      while (j >= 0 && s.bodies[s.order[j]].pose[2] > keyZ) {
        s.order[j + 1] = s.order[j]
        j--
      }
      s.order[j + 1] = key
    }
    for (k in 0 until count) {
      val i = s.order[k]
      val body = s.bodies[i]
      val lift = body.pose[2] - body.rest
      drawDie(
        canvas,
        body,
        body.pose[0],
        body.pose[1],
        s.size * (1.0 + lift * 0.0023),
        dropped.getOrElse(i) { false },
      )
    }
  }

  private fun drawTumble(canvas: Canvas, s: Scene, ms: Double) {
    for (i in s.bodies.indices) {
      val body = s.bodies[i]
      val progress = min(1.0, max(0.0, (ms - body.delay) / TUMBLE_MS))
      val pop = tumblePop(progress)
      val scale = 1.0 + 0.22 * pop
      val lift = -8.0 * pop
      val shadowScale = scale * (1.0 - 0.3 * pop)
      val w = s.cell * 0.5 * shadowScale
      val h = 8.0 * shadowScale
      shadowPaint.color = Color.argb((0.35 * (1.0 - 0.6 * pop) * 255.0).toInt(), 0, 0, 0)
      val shadowY = body.cy + 26.0 * scale + lift
      oval.set((body.cx - w / 2.0).toFloat(), (shadowY - h / 2.0).toFloat(), (body.cx + w / 2.0).toFloat(), (shadowY + h / 2.0).toFloat())
      canvas.drawRoundRect(oval, (h / 2.0).toFloat(), (h / 2.0).toFloat(), shadowPaint)
      tumbleQuaternionInto(body.target, body.axis, body.spin, progress, body.q)
      val grey = progress >= 1.0 && dropped.getOrElse(i) { false }
      drawDie(canvas, body, body.cx, body.cy + lift, s.size * scale, grey)
    }
  }

  /** Draws one body with its orientation in `body.q`, centred at (cx, cy) with a circumradius of `size`. */
  private fun drawDie(canvas: Canvas, body: Body, cx: Double, cy: Double, size: Double, grey: Boolean) {
    val q = body.q
    val base = if (grey) GREY_BODY else body.base
    val ink = if (grey) GREY_INK else body.ink
    val rotated = body.rotated
    for (v in body.verts.indices) rotateVectorInto(q, body.verts[v], rotated, v * 3)
    stroke.strokeWidth = max(1.0, size * 0.035).toFloat()
    stroke.color = Color.argb(if (grey) 89 else 128, 0, 0, 0)
    for (fi in body.faces.indices) {
      val face = body.faces[fi]
      rotateVectorInto(q, face.normal, normal, 0)
      if (normal[2] <= 0.004) continue
      val shade = faceShade(normal)
      val alpha = faceAlpha(normal[2])
      fill.color = Color.rgb(
        (base[0] * shade).toInt(),
        (base[1] * shade).toInt(),
        (base[2] * shade).toInt(),
      )
      path.reset()
      for (p in face.idx.indices) {
        val vi = face.idx[p] * 3
        val x = cx + rotated[vi] * size
        val y = cy - rotated[vi + 1] * size
        if (p == 0) path.moveTo(x.toFloat(), y.toFloat()) else path.lineTo(x.toFloat(), y.toFloat())
      }
      path.close()
      canvas.drawPath(path, fill)
      canvas.drawPath(path, stroke)

      inkPaint.color = Color.argb(
        (alpha * 255.0).toInt(),
        ink[0].toInt(),
        ink[1].toInt(),
        ink[2].toInt(),
      )
      for (li in face.labels.indices) {
        val label = face.labels[li]
        // labelMatrixInto gives the six numbers (a, b, c, d, e, f); Android's Matrix takes (scaleX, skewX, transX, skewY, scaleY, transY).
        labelMatrixInto(q, label.at, label.right, label.up, size, labelOut, labelScratch)
        matrixValues[0] = labelOut[0].toFloat()
        matrixValues[1] = labelOut[2].toFloat()
        matrixValues[2] = (cx + labelOut[4]).toFloat()
        matrixValues[3] = labelOut[1].toFloat()
        matrixValues[4] = labelOut[3].toFloat()
        matrixValues[5] = (cy + labelOut[5]).toFloat()
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
          val count = pipMarksInto(label.value, label.size, pipOut)
          for (k in 0 until count) {
            canvas.drawCircle(pipOut[k * 3].toFloat(), pipOut[k * 3 + 1].toFloat(), pipOut[k * 3 + 2].toFloat(), inkPaint)
          }
        }
        canvas.restore()
      }
    }
  }
}
