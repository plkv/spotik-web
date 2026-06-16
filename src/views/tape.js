import { Ticker } from '../ticker.js'

export class TapeView {
  constructor(container, items, { onSelect } = {}) {
    this.container = container
    this._ticker = new Ticker(container, items, { onSelect })
    this._active = true
  }

  setItems(items) {
    this._ticker.setItems(items)
  }

  show() {
    this._active = true
    this._ticker.setActive(true)
    this.container.style.pointerEvents = 'auto'
  }

  hide() {
    this._active = false
    this._ticker.setActive(false)
  }

  destroy() {
    this._ticker.destroy()
  }
}
