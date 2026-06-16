const CONFIG = {
  autoplay:       0.00008,
  speedPerPixel:  0.00111,
  direction:      'down',
  smoothing:      0.1,
  wheel:          0.5,
  drag:           1,
  visibleCount:   32,
  padding:        { top: 0, right: 0, bottom: 0, left: 0 },
  scaleTopPct:    10,
  scaleMidPct:    65,
  scaleBottomPct: 200,
  topShiftPct:    0,
  bottomShiftPct: 0,
  topPlanePct:    -45,
  bottomPlanePct: 74,
  cornerRadiusPx: 6,
}

const mod = (n, m) => ((n % m) + m) % m

export class Ticker {
  constructor(container, items, { onSelect } = {}) {
    this.container = container
    this.items     = items
    this.onSelect  = onSelect || null

    this._phase     = 0
    this._target    = 0
    this._interacted = false
    this._interactTimer = null
    this._rafId     = null
    this._active    = true
    this._sign      = CONFIG.direction === 'down' ? 1 : -1

    this._wraps   = []
    this._inners  = []
    this._heights = []
    this._containerH = 0

    this._build()
    this._bindEvents()
    this._rafId = requestAnimationFrame(this._tick.bind(this))
  }

  // ── Public ─────────────────────────────────────────────────────────────────

  setItems(items) {
    this.items = items
    this._rebuild()
  }

  setActive(active) {
    this._active = active
    if (!active) this._wraps.forEach(w => { w.style.opacity = '0'; w.style.pointerEvents = 'none' })
  }

  destroy() {
    cancelAnimationFrame(this._rafId)
    clearTimeout(this._interactTimer)
    this._unbindEvents()
    this._wraps.forEach(w => w.remove())
    this._measureWrap?.remove()
  }

  // ── Build DOM ───────────────────────────────────────────────────────────────

  _build() {
    this._measureWrap = document.createElement('div')
    this._measureWrap.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:-9999px;'
    this.container.appendChild(this._measureWrap)

    this.items.forEach((item, i) => this._buildSlot(item, i))
    this._measure()
    new ResizeObserver(() => this._measure()).observe(this.container)
  }

  _buildSlot(item, i) {
    const wrap = document.createElement('div')
    wrap.className = 'ticker-wrap'
    wrap.style.cssText = 'position:absolute;top:0;left:0;right:0;display:flex;justify-content:center;align-items:center;will-change:transform;opacity:0;'

    const inner = document.createElement('div')
    inner.className = 'ticker-inner'
    inner.style.cssText = `transform-origin:center center;will-change:transform;overflow:hidden;border-radius:${CONFIG.cornerRadiusPx}px;`

    const card = this._makeCard(item)
    inner.appendChild(card)
    wrap.appendChild(inner)
    this.container.appendChild(wrap)

    const mRef = document.createElement('div')
    mRef.appendChild(card.cloneNode(true))
    this._measureWrap.appendChild(mRef)

    this._wraps.push(wrap)
    this._inners.push(inner)
    this._heights.push(0)

    if (this.onSelect) {
      wrap.addEventListener('click', () => this.onSelect(item))
    }
  }

  _makeCard(item) {
    const el = document.createElement('div')
    el.className = 'ticker-card'
    el.style.backgroundImage = `url(${item.cover})`
    return el
  }

  _rebuild() {
    this._wraps.forEach(w => w.remove())
    this._wraps   = []
    this._inners  = []
    this._heights = []
    this._measureWrap.innerHTML = ''
    this.items.forEach((item, i) => this._buildSlot(item, i))
    this._measure()
  }

  _measure() {
    this._containerH = this.container.clientHeight
    const mRefs = this._measureWrap.children
    this._heights = Array.from(mRefs).map(el => Math.max(1, el.clientHeight || 0))
  }

  // ── Geometry ────────────────────────────────────────────────────────────────

  _geo() {
    const pad = CONFIG.padding
    const cStart = pad.top
    const cMain  = Math.max(1, this._containerH - pad.top - pad.bottom)

    const y0   = cStart + (CONFIG.topPlanePct    / 100) * cMain
    const y1   = cStart + (CONFIG.bottomPlanePct / 100) * cMain
    const mapY = t => y0 + t * (y1 - y0)

    const s0 = CONFIG.scaleTopPct    / 100
    const sm = CONFIG.scaleMidPct    / 100
    const s1 = CONFIG.scaleBottomPct / 100
    const c  = 2 * sm - 0.5 * (s0 + s1)
    const scaleAt = t => { const r = 1 - t; return r*r*s0 + 2*r*t*c + t*t*s1 }

    const T = Math.max(0, Math.min(1, CONFIG.topShiftPct    / 100))
    const B = Math.max(0, Math.min(1, 1 - CONFIG.bottomShiftPct / 100))
    const warp = t => (t - T) / Math.max(1e-4, B - T)

    return { cStart, cMain, mapY, warp, scaleAt }
  }

  // ── Tick ────────────────────────────────────────────────────────────────────

  _tick() {
    this._rafId = requestAnimationFrame(this._tick.bind(this))
    if (!this._active) return

    this._phase = this._phase + (this._target - this._phase) * CONFIG.smoothing
    if (!this._interacted) this._target += this._sign * CONFIG.autoplay

    const count = this.items.length
    if (count === 0) return

    const { cStart, cMain, mapY, warp, scaleAt } = this._geo()
    const vTop    = cStart
    const vBottom = cStart + cMain
    const spacing = 1 / CONFIG.visibleCount

    this._wraps.forEach(w => { w.style.opacity = '0'; w.style.pointerEvents = 'none' })

    for (let slot = 0; slot < CONFIG.visibleCount; slot++) {
      const slotPos = slot * spacing
      const idx     = mod(Math.floor(this._phase + slot), count)
      const wrap    = this._wraps[idx]
      const inner   = this._inners[idx]
      if (!wrap) continue

      const u  = mod(slotPos + this._phase, 1)
      const cy = mapY(u)
      const h  = this._heights[idx] || 1
      const tw = warp(u)
      const s  = scaleAt(tw)

      const top    = cy - (h * s) / 2
      const bottom = top + h * s
      if (bottom < vTop - 50 || top > vBottom + 50) continue

      const tc = Math.max(0, Math.min(1, tw))
      wrap.style.transform     = `translate3d(0,${cy}px,0)`
      wrap.style.zIndex        = String(1000 + Math.round(tc * 2000))
      wrap.style.opacity       = '1'
      wrap.style.pointerEvents = 'auto'
      inner.style.transform    = `translate3d(0,${-0.5 * h * s}px,0) scale(${s})`
    }
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  _markInteraction() {
    this._interacted = true
    clearTimeout(this._interactTimer)
    this._interactTimer = setTimeout(() => { this._interacted = false }, 3000)
  }

  _onWheel = (e) => {
    if (!this._active) return
    e.preventDefault()
    this._markInteraction()
    const dy = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    this._target += dy * CONFIG.speedPerPixel * CONFIG.wheel
  }

  _dragState = { id: null, lastY: null, startY: null, startTarget: null, dragged: false }

  _onPointerDown = (e) => {
    if (!this._active || this._dragState.id !== null) return
    if (e.target.closest('.view-toggle')) return
    this._dragState.id          = e.pointerId
    this._dragState.lastY       = e.clientY
    this._dragState.startY      = e.clientY
    this._dragState.startTarget = e.target
    this._dragState.dragged     = false
    this.container.setPointerCapture(e.pointerId)
  }

  _onPointerMove = (e) => {
    if (this._dragState.id !== e.pointerId) return
    const dy = e.clientY - (this._dragState.lastY ?? e.clientY)
    if (Math.abs(e.clientY - this._dragState.startY) > 6) {
      this._dragState.dragged = true
      e.preventDefault()
      this._markInteraction()
    }
    if (!this._dragState.dragged) return
    this._dragState.lastY = e.clientY
    this._target += dy * CONFIG.speedPerPixel * CONFIG.drag * this._sign
  }

  _onPointerEnd = (e) => {
    if (this._dragState.id !== e.pointerId) return
    // Tap (no drag) → fire onSelect on the original target's wrap
    if (!this._dragState.dragged && this.onSelect) {
      const wrap = this._dragState.startTarget?.closest?.('.ticker-wrap')
      if (wrap) {
        const idx = this._wraps.indexOf(wrap)
        if (idx >= 0) this.onSelect(this.items[idx])
      }
    }
    try { this.container.releasePointerCapture(e.pointerId) } catch {}
    this._dragState.id          = null
    this._dragState.lastY       = null
    this._dragState.startTarget = null
    this._dragState.dragged     = false
  }

  _bindEvents() {
    this.container.addEventListener('wheel',        this._onWheel,       { passive: false })
    this.container.addEventListener('pointerdown',  this._onPointerDown)
    this.container.addEventListener('pointermove',  this._onPointerMove)
    this.container.addEventListener('pointerup',    this._onPointerEnd)
    this.container.addEventListener('pointercancel',this._onPointerEnd)
  }

  _unbindEvents() {
    this.container.removeEventListener('wheel',        this._onWheel)
    this.container.removeEventListener('pointerdown',  this._onPointerDown)
    this.container.removeEventListener('pointermove',  this._onPointerMove)
    this.container.removeEventListener('pointerup',    this._onPointerEnd)
    this.container.removeEventListener('pointercancel',this._onPointerEnd)
  }
}
