export class Filters {
  constructor(container, playlists, { onChange } = {}) {
    this.container  = container
    this.playlists  = playlists
    this.onChange   = onChange || null
    this.active     = new Set()

    this._allTags = this._extractTags()
    this._render()
  }

  getFiltered() {
    if (this.active.size === 0) return this.playlists
    return this.playlists.filter(p =>
      p.tags.some(t => this.active.has(t))
    )
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _extractTags() {
    const counts = new Map()
    this.playlists.forEach(p =>
      p.tags.forEach(t => counts.set(t, (counts.get(t) || 0) + 1))
    )
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
  }

  _render() {
    this.container.innerHTML = ''

    const all = document.createElement('button')
    all.className = 'filter-chip filter-chip--all' + (this.active.size === 0 ? ' active' : '')
    all.textContent = 'All'
    all.addEventListener('click', () => this._clearAll())
    this.container.appendChild(all)

    this._allTags.forEach(tag => {
      const btn = document.createElement('button')
      btn.className = 'filter-chip' + (this.active.has(tag) ? ' active' : '')
      btn.textContent = tag
      btn.dataset.tag = tag
      btn.addEventListener('click', () => this._toggle(tag))
      this.container.appendChild(btn)
    })
  }

  _toggle(tag) {
    if (this.active.has(tag)) this.active.delete(tag)
    else this.active.add(tag)
    this._render()
    this.onChange?.(this.getFiltered())
  }

  _clearAll() {
    this.active.clear()
    this._render()
    this.onChange?.(this.getFiltered())
  }
}
