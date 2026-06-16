export class GridView {
  constructor(container, items, { onSelect } = {}) {
    this.container = container
    this.onSelect  = onSelect || null
    this._el = document.getElementById('grid-view')
    this._render(items)
  }

  setItems(items) {
    this._render(items)
  }

  show() {
    this._el.classList.add('active')
  }

  hide() {
    this._el.classList.remove('active')
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _render(items) {
    this._el.innerHTML = ''
    items.forEach(item => {
      const card = document.createElement('div')
      card.className = 'grid-card'
      card.style.backgroundImage = `url(${item.cover})`
      card.setAttribute('aria-label', item.title)
      if (this.onSelect) card.addEventListener('click', () => this.onSelect(item))
      this._el.appendChild(card)
    })
  }
}
