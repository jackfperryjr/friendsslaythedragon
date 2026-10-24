import Phaser from 'phaser'

/**
 * Calls `handler` once per real key press while `scene` is running, using the
 * browser's own keydown events. Auto-repeat from holding a key is ignored.
 *
 * Use this for menus and one-shot actions instead of Phaser's
 * `keyboard.on('keydown…')` events: Phaser can deliver the same keydown twice
 * when several key events arrive within one frame, which double-moves cursors
 * and makes toggles (pause) cancel themselves out.
 */
export function onKeyPress(scene: Phaser.Scene, handler: (e: KeyboardEvent) => void): () => void {
  const listener = (e: KeyboardEvent) => {
    if (e.repeat || !scene.sys.isActive()) return
    handler(e)
  }
  window.addEventListener('keydown', listener)
  const off = () => window.removeEventListener('keydown', listener)
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off)
  scene.events.once(Phaser.Scenes.Events.DESTROY, off)
  return off
}
