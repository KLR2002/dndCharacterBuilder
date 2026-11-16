package expo.modules.dicecanvas

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DiceCanvasModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DiceCanvas")

    View(DiceCanvasView::class) {
      Prop("scene") { view: DiceCanvasView, scene: String? ->
        view.setScene(scene)
      }
      Prop("dropped") { view: DiceCanvasView, dropped: String? ->
        view.setDropped(dropped)
      }
    }
  }
}
