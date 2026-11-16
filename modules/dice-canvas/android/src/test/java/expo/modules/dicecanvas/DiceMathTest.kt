package expo.modules.dicecanvas

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

private const val TOLERANCE = 1e-4

class DiceMathTest {
  private val fixture = JSONObject(File(System.getProperty("dice.fixture")!!).readText())

  private fun doubles(array: JSONArray) = DoubleArray(array.length()) { array.getDouble(it) }

  private fun doubles(obj: JSONObject, key: String) = doubles(obj.getJSONArray(key))

  private fun assertClose(expected: DoubleArray, actual: DoubleArray, label: String) {
    assertEquals("$label: length", expected.size, actual.size)
    for (i in expected.indices) assertEquals("$label[$i]", expected[i], actual[i], TOLERANCE)
  }

  private fun forEachCase(key: String, body: (JSONObject, Int) -> Unit) {
    val list = fixture.getJSONArray(key)
    for (i in 0 until list.length()) body(list.getJSONObject(i), i)
  }

  @Test
  fun rotateVector() = forEachCase("rotateVector") { c, i ->
    assertClose(doubles(c, "expected"), rotateVector(doubles(c, "q"), doubles(c, "v")), "rotateVector $i")
  }

  @Test
  fun quatMultiply() = forEachCase("quatMultiply") { c, i ->
    assertClose(doubles(c, "expected"), quatMultiply(doubles(c, "a"), doubles(c, "b")), "quatMultiply $i")
  }

  @Test
  fun quatFromAxisAngle() = forEachCase("quatFromAxisAngle") { c, i ->
    assertClose(doubles(c, "expected"), quatFromAxisAngle(doubles(c, "axis"), c.getDouble("angle")), "quatFromAxisAngle $i")
  }

  @Test
  fun sampleThrow() {
    val throwFixture = fixture.getJSONObject("throw")
    val frameCount = throwFixture.getInt("frameCount")
    val bodies = throwFixture.getJSONArray("bodies")
    val samples = throwFixture.getJSONArray("samples")
    for (k in 0 until samples.length()) {
      val s = samples.getJSONObject(k)
      val frames = doubles(bodies.getJSONArray(s.getInt("body")))
      val pose = sampleThrow(frames, frameCount, s.getDouble("seconds"))
      assertClose(doubles(s, "expected"), doubleArrayOf(pose.x, pose.y, pose.z, *pose.q), "sampleThrow $k")
    }
  }

  @Test
  fun tumbleQuaternion() = forEachCase("tumble") { c, i ->
    val actual = tumbleQuaternion(doubles(c, "target"), doubles(c, "axis"), c.getDouble("spin"), c.getDouble("progress"))
    assertClose(doubles(c, "expected"), actual, "tumble $i ${c.getString("die")}")
  }

  @Test
  fun tumblePop() = forEachCase("tumblePop") { c, i ->
    assertClose(doubleArrayOf(c.getDouble("expected")), doubleArrayOf(tumblePop(c.getDouble("progress"))), "tumblePop $i")
  }

  @Test
  fun pipMarks() = forEachCase("pipMarks") { c, i ->
    val expected = c.getJSONArray("expected")
    val marks = pipMarks(c.getInt("value"), c.getDouble("halfSize"))
    assertEquals("pipMarks $i: count", expected.length(), marks.size)
    for (m in marks.indices) {
      val mark = doubles(expected.getJSONArray(m))
      assertClose(mark, doubleArrayOf(marks[m].cx, marks[m].cy, marks[m].r), "pipMarks $i mark $m")
    }
  }

  @Test
  fun faceShading() = forEachCase("faceShading") { c, i ->
    val shading = faceShading(doubles(c, "normal"))
    assertClose(doubles(c, "expected"), doubleArrayOf(shading.shade, shading.alpha), "faceShading $i")
  }

  @Test
  fun labelMatrix() = forEachCase("labelMatrix") { c, i ->
    val actual = labelMatrix(doubles(c, "q"), doubles(c, "at"), doubles(c, "right"), doubles(c, "up"), c.getDouble("dieSize"))
    assertClose(doubles(c, "expected"), actual, "labelMatrix $i ${c.getString("die")}")
  }
}
