const CONFIG = {
  autoplay:       0.00008,
  speedPerPixel:  0.00111,
  direction:      'down',
  smoothing:      0.1,
  wheel:          0.5,
  drag:           1,
  visibleCount:   32,
  padding:        { top: 24, right: 0, bottom: 0, left: 0 },
  scaleTopPct:    6,
  scaleMidPct:    32.5,
  scaleBottomPct: 100,
  topShiftPct:    0,
  bottomShiftPct: 0,
  topPlanePct:    0,
  bottomPlanePct: 74,
  cornerRadiusPx: 6,
}

const mod = (n, m) => ((n % m) + m) % m

export class Ticker {
  constructor(container, items, { onSelect } = {}) {
    this.container = container
    this.items     = items
    this.onSelect  = onSelect || null

    this._phase         = 0
    this._target        = 0
    this._interacted    = false
    this._rafId         = null
    this._active        = true
    this._sign          = CONFIG.direction === 'down' ? 1 : -1

    // visibleCount slot elements — independent of items.length
    this._wraps     = []
    this._inners    = []
    this._cards     = []
    this._slotItems = []  // item currently painted in each slot (for click detection)
    this._prevU     = new Array(CONFIG.visibleCount).fill(-1)  // previous u per slot for wrap detection
    this._wrapCount = new Array(CONFIG.visibleCount).fill(0)   // how many times each slot has wrapped

    // Geometry cache — recomputed only on resize, not per frame
    this._cardH      = 0
    this._containerH = 0
    this._geo        = null  // { cStart, cMain, vTop, vBottom, mapY, warp, scaleAt }

    this._ro         = null  // ResizeObserver — stored so destroy() can disconnect it
    this._audioCtx   = null  // lazy-init on first interaction
    this._clickBuf   = null  // pre-baked click buffer — generated once, reused per tick
    this._clickOut   = null  // shared output gain node

    this._build()
    this._bindEvents()
    this._rafId = requestAnimationFrame(this._tick.bind(this))

    // Unlock AudioContext on the very first user gesture anywhere on the page.
    // Wheel events don't satisfy Chrome/Safari's audio autoplay policy, so we
    // pre-warm the context on the earliest possible pointer/key event.
    this._unlockAudio = () => {
      try {
        if (!this._audioCtx) this._initAudio()
        else if (this._audioCtx.state === 'suspended') this._audioCtx.resume()
      } catch {}
      this._interacted = true  // stop autoplay on first touch anywhere on page
      document.removeEventListener('pointerdown', this._unlockAudio, true)
      document.removeEventListener('keydown',     this._unlockAudio, true)
    }
    document.addEventListener('pointerdown', this._unlockAudio, { capture: true, once: true })
    document.addEventListener('keydown',     this._unlockAudio, { capture: true, once: true })
  }

  // ── Public ──────────────────────────────────────────────────────────────────

  setItems(items) {
    this.items = items
    this._wrapCount.fill(0)
  }

  setActive(active) {
    this._active = active
    if (!active) this._wraps.forEach(w => { w.style.opacity = '0'; w.style.pointerEvents = 'none' })
  }

  destroy() {
    cancelAnimationFrame(this._rafId)
    this._unbindEvents()
    this._ro?.disconnect()
    this._audioCtx?.close()
    document.removeEventListener('pointerdown', this._unlockAudio, true)
    document.removeEventListener('keydown',     this._unlockAudio, true)
    this._wraps.forEach(w => w.remove())
    this._measureCard?.remove()
  }

  // ── Audio ────────────────────────────────────────────────────────────────────

  _initAudio() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    this._audioCtx = ctx

    // Output gain — created synchronously so _playTick can connect to it immediately
    this._clickOut = ctx.createGain()
    this._clickOut.gain.value = 0.35
    this._clickOut.connect(ctx.destination)

    // Load click.mp3 async — _clickBuf is set when ready; _playTick guards on it
    fetch('/click.mp3')
      .then(r => r.arrayBuffer())
      .then(ab => ctx.decodeAudioData(ab))
      .then(buf => { this._clickBuf = buf })
      .catch(e => console.error('[ticker] click.mp3 load failed:', e))
  }

  _playTick() {
    if (!this._audioCtx || !this._clickBuf || !this._clickOut) return
    const ctx = this._audioCtx
    const fire = () => {
      try {
        const src = ctx.createBufferSource()
        src.buffer = this._clickBuf
        src.playbackRate.value = 0.9 + Math.random() * 0.2
        src.connect(this._clickOut)
        src.start()
      } catch {}
    }
    if (ctx.state === 'suspended') ctx.resume().then(fire)
    else fire()
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  _build() {
    this._measureCard = document.createElement('div')
    this._measureCard.className = 'ticker-card'
    this._measureCard.style.cssText =
      'position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:-9999px;'
    this.container.appendChild(this._measureCard)

    for (let i = 0; i < CONFIG.visibleCount; i++) {
      const wrap = document.createElement('div')
      wrap.className = 'ticker-wrap'
      wrap.style.cssText =
        'position:absolute;top:0;left:0;right:0;display:flex;justify-content:center;align-items:center;will-change:transform;opacity:0;'

      const inner = document.createElement('div')
      inner.className = 'ticker-inner'
      inner.style.cssText =
        `transform-origin:center center;will-change:transform;overflow:hidden;border-radius:${CONFIG.cornerRadiusPx}px;`

      const card = document.createElement('div')
      card.className = 'ticker-card'

      inner.appendChild(card)
      wrap.appendChild(inner)
      this.container.appendChild(wrap)

      this._wraps.push(wrap)
      this._inners.push(inner)
      this._cards.push(card)
      this._slotItems.push(null)
    }

    this._measure()
    this._ro = new ResizeObserver(() => this._measure())
    this._ro.observe(this.container)
  }

  // _measure recomputes everything that depends on container/card size.
  // Called only on mount + resize — never per frame.
  _measure() {
    this._containerH = this.container.clientHeight
    this._cardH      = Math.max(1, this._measureCard.clientHeight || 230)
    this._geo        = this._computeGeo()
  }

  _computeGeo() {
    const pad    = CONFIG.padding
    const cStart = pad.top
    const cMain  = Math.max(1, this._containerH - pad.top - pad.bottom)

    const y0     = cStart + (CONFIG.topPlanePct    / 100) * cMain
    const y1raw  = cStart + (CONFIG.bottomPlanePct / 100) * cMain
    const y1     = Math.min(y1raw, this._containerH - pad.bottom - this._cardH / 2)
    const mapY = t => y0 + t * (y1 - y0)

    const s0 = CONFIG.scaleTopPct    / 100
    const sm = CONFIG.scaleMidPct    / 100
    const s1 = CONFIG.scaleBottomPct / 100
    const c  = 2 * sm - 0.5 * (s0 + s1)
    const scaleAt = t => { const r = 1 - t; return r * r * s0 + 2 * r * t * c + t * t * s1 }

    const T    = Math.max(0, Math.min(1, CONFIG.topShiftPct    / 100))
    const B    = Math.max(0, Math.min(1, 1 - CONFIG.bottomShiftPct / 100))
    const warp = t => (t - T) / Math.max(1e-4, B - T)

    return { cStart, cMain, vTop: cStart, vBottom: cStart + cMain, mapY, warp, scaleAt }
  }

  // ── Tick ─────────────────────────────────────────────────────────────────────

  _tick() {
    this._rafId = requestAnimationFrame(this._tick.bind(this))
    if (!this._active || !this._geo) return

    const count = this.items.length
    if (count === 0) {
      this._wraps.forEach(w => { w.style.opacity = '0'; w.style.pointerEvents = 'none' })
      return
    }

    // Single item: show statically at the focal point, no scrolling
    if (count === 1) {
      const { mapY, warp, scaleAt } = this._geo
      const item = this.items[0]
      const h    = this._cardH
      const u    = 0.72
      const cy   = mapY(u)
      const s    = scaleAt(warp(u))

      if (this._slotItems[0] !== item) {
        this._cards[0].style.backgroundImage = `url("${item.cover}")`
        this._slotItems[0] = item
      }

      this._wraps[0].style.transform     = `translate3d(0,${cy - h * (1 - s) / 2}px,0)`
      this._wraps[0].style.zIndex        = '2000'
      this._wraps[0].style.opacity       = '1'
      this._wraps[0].style.pointerEvents = 'auto'
      this._inners[0].style.transform    = `translate3d(0,${-0.5 * h * s}px,0) scale(${s})`

      for (let i = 1; i < CONFIG.visibleCount; i++) {
        this._wraps[i].style.opacity      = '0'
        this._wraps[i].style.pointerEvents = 'none'
      }
      return
    }

    // Track card-level crossings: fires once per card that scrolls past
    const prevTick = Math.floor(this._phase * count)
    this._phase = this._phase + (this._target - this._phase) * CONFIG.smoothing
    if (!this._interacted) this._target += this._sign * CONFIG.autoplay

    // Click sound on each card crossing — only while user is scrolling
    if (this._interacted) {
      const newTick = Math.floor(this._phase * count)
      if (newTick !== prevTick) this._playTick()
    }

    const { cStart, cMain, vTop, vBottom, mapY, warp, scaleAt } = this._geo
    const spacing = 1 / CONFIG.visibleCount
    const h       = this._cardH

    for (let slot = 0; slot < CONFIG.visibleCount; slot++) {
      const u     = mod(slot * spacing + this._phase, 1)
      const prevU = this._prevU[slot]
      this._prevU[slot] = u

      // When there are more items than slots, advance this slot's item on each
      // wrap so every item becomes reachable by scrolling. For count ≤ visibleCount
      // wrapCount stays 0 — each slot keeps the same item forever (no jump artifact).
      if (count > CONFIG.visibleCount && prevU >= 0 && Math.abs(u - prevU) > 0.5) {
        if (u < prevU - 0.5) this._wrapCount[slot]++
        else                  this._wrapCount[slot]--
      }

      const item = this.items[mod(slot + this._wrapCount[slot], count)]

      if (this._slotItems[slot] !== item) {
        this._cards[slot].style.backgroundImage = `url("${item.cover}")`
        this._slotItems[slot] = item
      }

      const cy = mapY(u)
      const tw = warp(u)
      const s  = scaleAt(tw)

      // Slot wrapped this frame — pre-move to new position (opacity=0) so the
      // GPU composites it there before we reveal it next frame.
      if (prevU >= 0 && Math.abs(u - prevU) > 0.5) {
        this._wraps[slot].style.transform     = `translate3d(0,${cy - h*(1-s)/2}px,0)`
        this._wraps[slot].style.opacity       = '0'
        this._wraps[slot].style.pointerEvents = 'none'
        continue
      }

      const top    = cy - (h * s) / 2
      const bottom = top + h * s

      if (bottom < vTop - 50 || top > vBottom + 50) {
        this._wraps[slot].style.opacity      = '0'
        this._wraps[slot].style.pointerEvents = 'none'
        continue
      }

      const tc = Math.max(0, Math.min(1, tw))
      this._wraps[slot].style.transform     = `translate3d(0,${cy - h * (1 - s) / 2}px,0)`
      this._wraps[slot].style.zIndex        = String(1000 + Math.round(tc * 2000))
      this._wraps[slot].style.opacity       = '1'
      this._wraps[slot].style.pointerEvents = 'auto'
      this._inners[slot].style.transform    = `translate3d(0,${-0.5 * h * s}px,0) scale(${s})`
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  _stopAutoplay() {
    this._interacted = true
    if (!this._audioCtx) {
      try { this._initAudio() } catch {}
    }
  }

  _onWheel = (e) => {
    if (!this._active) return
    e.preventDefault()
    this._stopAutoplay()
    const dy = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    this._target += dy * CONFIG.speedPerPixel * CONFIG.wheel
  }

  _dragState = { id: null, lastY: null, startY: null, startTarget: null, dragged: false }

  _onPointerDown = (e) => {
    if (!this._active || this._dragState.id !== null) return
    if (e.target.closest('.view-toggle')) return
    this._stopAutoplay()
    this._dragState.id          = e.pointerId
    this._dragState.lastY       = e.clientY
    this._dragState.startY      = e.clientY
    this._dragState.startTarget = e.target
    this._dragState.dragged     = false
    this.container.setPointerCapture(e.pointerId)
  }

  _onPointerMove = (e) => {
    if (this._dragState.id !== e.pointerId) return
    if (Math.abs(e.clientY - this._dragState.startY) > 6) {
      this._dragState.dragged = true
      e.preventDefault()
    }
    if (!this._dragState.dragged) return
    const dy = e.clientY - (this._dragState.lastY ?? e.clientY)
    this._dragState.lastY = e.clientY
    this._target += dy * CONFIG.speedPerPixel * CONFIG.drag * this._sign
  }

  _onPointerEnd = (e) => {
    if (this._dragState.id !== e.pointerId) return
    if (!this._dragState.dragged && this.onSelect) {
      const wrap = this._dragState.startTarget?.closest?.('.ticker-wrap')
      if (wrap) {
        const slotIdx = this._wraps.indexOf(wrap)
        if (slotIdx >= 0) {
          const item = this._slotItems[slotIdx]
          if (item) this.onSelect(item)
        }
      }
    }
    try { this.container.releasePointerCapture(e.pointerId) } catch {}
    this._dragState = { id: null, lastY: null, startY: null, startTarget: null, dragged: false }
  }

  _bindEvents() {
    this.container.addEventListener('wheel',         this._onWheel,       { passive: false })
    this.container.addEventListener('pointerdown',   this._onPointerDown)
    this.container.addEventListener('pointermove',   this._onPointerMove)
    this.container.addEventListener('pointerup',     this._onPointerEnd)
    this.container.addEventListener('pointercancel', this._onPointerEnd)
  }

  _unbindEvents() {
    this.container.removeEventListener('wheel',         this._onWheel)
    this.container.removeEventListener('pointerdown',   this._onPointerDown)
    this.container.removeEventListener('pointermove',   this._onPointerMove)
    this.container.removeEventListener('pointerup',     this._onPointerEnd)
    this.container.removeEventListener('pointercancel', this._onPointerEnd)
  }
}
