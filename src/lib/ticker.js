const CONFIG = {
  autoplay:       0,
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
  bottomPlanePct: 65,
  cornerRadiusPx: 6,
}

// ── Journey layout ───────────────────────────────────────────────────────────
// Every card is placed by its signed distance from the active card, measured in
// card-steps:  dist = 0 → active (centered, frontal);  dist < 0 → tail (behind,
// above, shrinking);  dist > 0 → foreground (in front, below, larger, tilted
// toward the viewer). Scrolling slides every card along these curves, so a card
// flows tail → active → foreground → off-screen as one continuous animation.
const TAIL_MAX  = 5     // max cards rendered behind the active one
const FRONT_MAX = 2     // max cards rendered in front of the active one
const FADE_BAND = 0.6   // extra step at each end over which cards fade in/out
const VIS_LO    = -(TAIL_MAX + FADE_BAND)
const VIS_HI    =  (FRONT_MAX + FADE_BAND)

// Control points: dist → value, linearly interpolated. Must be sorted by dist.
// Y is a fraction of container height (card centre).
//
// Active card (dist 0) is centred, frontal and large (~400px). Tail (dist < 0)
// is a tight stack of slivers just behind/above the active. Foreground (dist >
// 0) is NOT slid far down — instead it "falls toward us" like a vinyl record
// being flipped forward in a crate: it drops only a little, tilts hard toward
// the viewer (top edge grows in perspective) and squashes vertically. It stays
// fully opaque and simply switches off once it slides off the bottom edge.
const Y_PTS = [
  [-5.6, 0.330], [-5.0, 0.345], [-3.0, 0.400], [-1.0, 0.460],
  [ 0.0, 0.50], [ 0.25, 0.51], [ 0.37, 0.59], [ 0.48, 0.91], [ 0.58, 1.00], [ 1.0, 1.045], [ 2.0, 1.055], [ 2.6, 1.20],
]
const S_PTS = [
  [-5.6, 0.51], [-5.0, 0.55], [-3.0, 0.66], [-1.0, 0.78],
  [ 0.0, 0.84], [ 0.25, 0.84], [ 0.37, 0.81], [ 0.48, 0.71], [ 0.58, 0.68], [ 1.0, 0.68], [ 2.0, 0.72], [ 2.6, 0.74],
]
// rotateX degrees: 0 at the active card (frontal, undistorted). Tail leans
// gently back. Foreground flips toward the viewer (negative = top tips forward
// and enlarges) — the "falling onto us" of a flipped record.
const TILT_PTS = [
  [-5.6, 9], [-3.0, 7], [-1.0, 3], [0.0, 0], [0.25, 0], [0.37, -6], [0.48, -30], [0.58, -36], [1.0, -36], [2.0, -42], [2.6, -46],
]
// Vertical squash (scaleY multiplier): 1 everywhere except the foreground,
// which compresses hard as it flips forward so it reads as a foreshortened
// sliver poking up from the bottom rather than a full card.
const SQ_PTS = [
  [-1.0, 1.0], [0.0, 1.0], [0.25, 1.0], [0.37, 0.92], [0.48, 0.66], [0.58, 0.58], [1.0, 0.60], [2.0, 0.56], [2.6, 0.52],
]
const OP_PTS = [
  [-5.6, 0], [-5.0, 1], [2.6, 1],
]

function lerpAt(points, x) {
  if (x <= points[0][0]) return points[0][1]
  const n = points.length
  if (x >= points[n - 1][0]) return points[n - 1][1]
  for (let i = 1; i < n; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1]
      const [x1, y1] = points[i]
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0))
    }
  }
  return points[n - 1][1]
}

const mod = (n, m) => ((n % m) + m) % m
const easeOutQuart = t => 1 - (1 - t) ** 4
// Overshoot easing for the magnetic snap — settles past the target then back.
const easeOutBack = t => {
  const c1 = 2.2, c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}
const SNAP_MS = 520

// Focus / expand: tapped card flies to the TOP (frontal), content flows below.
const FOCUS_TOP   = 70      // card top edge (px from viewport top) when expanded
const FOCUS_SCALE = 0.84    // card width = natural × this (= content column width)
const FOCUS_MS    = 620     // duration of the (eased) focus in/out animation
const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export class Ticker {
  constructor(container, items, { onSelect, active = true } = {}) {
    this.container = container
    this.items     = items
    this.onSelect  = onSelect || null

    this._phase      = 0
    this._target     = 0
    this._interacted = false
    this._rafId      = null
    this._active     = active
    this._sign       = CONFIG.direction === 'down' ? 1 : -1

    this._revealStart = null

    this._heldKey    = null
    this._holdStartT = 0
    this._lastInput  = 0
    this._snap       = null
    this._focus      = null
    this._suppress   = false

    this._wraps     = []
    this._inners    = []
    this._cards     = []
    this._tagEls    = []
    this._slotItems = []
    this._prevU     = new Array(CONFIG.visibleCount).fill(-1)
    this._wrapCount = new Array(CONFIG.visibleCount).fill(0)

    this._cardH      = 0
    this._containerH = 0
    this._geo        = null

    this._ro       = null
    this._audioCtx = null
    this._clickBuf = null
    this._clickOut = null

    this._build()
    this._bindEvents()
    this._rafId = requestAnimationFrame(this._tick.bind(this))

    this._unlockAudio = () => {
      try {
        if (!this._audioCtx) this._initAudio()
        else if (this._audioCtx.state === 'suspended') this._audioCtx.resume()
      } catch {}
      this._interacted = true
      document.removeEventListener('pointerdown', this._unlockAudio, true)
      document.removeEventListener('keydown',     this._unlockAudio, true)
    }
    document.addEventListener('pointerdown', this._unlockAudio, { capture: true, once: true })
    document.addEventListener('keydown',     this._unlockAudio, { capture: true, once: true })
  }

  // ── Public ──────────────────────────────────────────────────────────────────

  setItems(items) {
    this.items = items
    this._focus = null
    this._suppress = false
    this._wrapCount.fill(0)
  }

  setActive(active) {
    this._active = active
    if (!active) {
      this._focus = null
      this._wraps.forEach(w => { w.style.opacity = '0'; w.style.pointerEvents = 'none' })
    }
  }

  reveal() {
    this._active      = true
    this._phase       = 0
    this._target      = 0
    this._focus       = null
    this._revealStart = performance.now()
    this._prevU.fill(-1)
    this._wrapCount.fill(0)
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
    this._clickOut = ctx.createGain()
    this._clickOut.gain.value = 0.35
    this._clickOut.connect(ctx.destination)
    fetch('/click.mp3')
      .then(r => r.arrayBuffer())
      .then(ab => ctx.decodeAudioData(ab))
      .then(buf => { this._clickBuf = buf })
      .catch(() => {})
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

      const tags = document.createElement('div')
      tags.className = 'ticker-tags'
      card.appendChild(tags)

      inner.appendChild(card)
      wrap.appendChild(inner)
      this.container.appendChild(wrap)

      this._wraps.push(wrap)
      this._inners.push(inner)
      this._cards.push(card)
      this._tagEls.push(tags)
      this._slotItems.push(null)
    }

    this._measure()
    this._ro = new ResizeObserver(() => this._measure())
    this._ro.observe(this.container)
  }

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
    const mapY   = t => y0 + t * (y1 - y0)
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

  // Signed distance (in card-steps) from the active card. Cards behind it get
  // negative dist, cards in front get positive dist.
  //
  // The active card (dist 0) is anchored at u = 0.5 — NOT u = 0. The carousel's
  // wrap seam is at u = 0/1: that's where a slot silently swaps to its next item
  // (when there are more items than slots) and is hidden for a frame. If the
  // active sat at the seam, it would abruptly swap item / jump order. Putting it
  // at u = 0.5 moves the seam to the hidden antipode (dist ±VC/2), far from any
  // visible card, so the swap is invisible.
  _dist(u) {
    return (u - 0.5) * CONFIG.visibleCount
  }

  // Placement for a card at the given signed distance from active.
  _layout(dist) {
    return {
      cy:      lerpAt(Y_PTS, dist) * this._containerH,
      s:       lerpAt(S_PTS, dist),
      tilt:    lerpAt(TILT_PTS, dist),
      squash:  lerpAt(SQ_PTS, dist),
      op:      lerpAt(OP_PTS, dist),
      // Monotonic: foreground sits ABOVE the active in z (as a flipped record
      // would lie on top of the crate); it's kept off the active's face by
      // geometry, not z-order.
      z:       Math.round(2000 + dist * 200),
      visible: dist >= VIS_LO && dist <= VIS_HI,
    }
  }

  // ── Tick ─────────────────────────────────────────────────────────────────────

  _tickReveal() {
    const STAGGER_MS = 700
    const CARD_MS    = 480
    const elapsed = performance.now() - this._revealStart
    const { vTop, vBottom } = this._geo
    const h       = this._cardH
    const spacing = 1 / CONFIG.visibleCount
    const count   = this.items.length
    if (!count) return

    const startY = this._containerH * 0.5
    let allDone  = true

    for (let slot = 0; slot < CONFIG.visibleCount; slot++) {
      const u    = mod(slot * spacing + this._phase, 1)
      const dist = this._dist(u)
      const L    = this._layout(dist)

      const item = this.items[mod(slot + this._wrapCount[slot], count)]
      if (this._slotItems[slot] !== item) {
        this._cards[slot].style.backgroundImage = `url("${item.cover}")`
        this._tagEls[slot].innerHTML = (item.tags || [])
          .map(t => `<span class="ticker-tag">${t}</span>`).join('')
        this._slotItems[slot] = item
      }

      if (!L.visible) {
        this._wraps[slot].style.opacity      = '0'
        this._wraps[slot].style.pointerEvents = 'none'
        continue
      }

      const finalCy = L.cy
      const finalS  = L.s
      const posNorm = Math.max(0, Math.min(1, (vBottom - finalCy) / Math.max(1, vBottom - vTop)))
      const delay   = posNorm * STAGGER_MS
      const slotT   = Math.min(1, Math.max(0, elapsed - delay) / CARD_MS)
      const easedT  = easeOutQuart(slotT)
      if (slotT < 1) allDone = false

      const startS = finalS * 0.2
      const cy   = startY + (finalCy - startY) * easedT
      const s    = startS + (finalS  - startS) * easedT
      const tilt = L.tilt * easedT
      const sqv  = 1 + (L.squash - 1) * easedT
      const sy   = (s * sqv).toFixed(4)

      this._wraps[slot].style.transform     = `translate3d(0,${cy - h * (1 - s) / 2}px,0)`
      this._wraps[slot].style.zIndex        = String(L.z)
      this._wraps[slot].style.opacity       = String(easedT * L.op)
      this._wraps[slot].style.pointerEvents = 'none'
      this._inners[slot].style.transform    = Math.abs(tilt) > 0.2
        ? `perspective(600px) rotateX(${tilt.toFixed(1)}deg) translate3d(0,${(-0.5 * h * s).toFixed(2)}px,0) scale(${s.toFixed(4)},${sy})`
        : `translate3d(0,${(-0.5 * h * s).toFixed(2)}px,0) scale(${s.toFixed(4)},${sy})`
    }

    if (allDone) {
      for (let slot = 0; slot < CONFIG.visibleCount; slot++) {
        this._prevU[slot] = mod(slot * (1 / CONFIG.visibleCount) + this._phase, 1)
      }
      this._revealStart = null
    }
  }

  // ── Focus / expand ───────────────────────────────────────────────────────────

  // Tapped card flies to a frontal hero position; the carousel is rotated so it
  // becomes the active card, so closing returns it to the active slot.
  // Focus whichever slot currently shows this item. If it isn't on screen
  // (e.g. opened from a deep-link/hash rather than a tap), just suppress the
  // deck so it doesn't render behind the panel.
  focusItem(id) {
    if (this._focus) return
    for (let i = 0; i < CONFIG.visibleCount; i++) {
      if (this._slotItems[i] && this._slotItems[i].id === id) {
        this._startFocus(i, this._slotItems[i]); return
      }
    }
    this._suppress = true
  }

  _startFocus(slot, item) {
    if (this._focus || !this._geo) return
    this._suppress = false
    this._stopAutoplay()
    const spacing = 1 / CONFIG.visibleCount
    const L = this._layout(this._dist(mod(slot * spacing + this._phase, 1)))
    const anchor = { cy: L.cy, s: L.s, tilt: L.tilt, squash: L.squash }
    const targetFrac = 0.5 - slot * spacing
    this._phase = this._target = targetFrac + Math.round(this._phase - targetFrac)
    this._snap  = null
    this._focus = { slot, item, anchor, dir: 1, start: performance.now(), fromP: 0, p: 0, openAt: 0 }
  }

  // Screen rects of the cards currently on screen, keyed by item id — used to
  // FLIP-animate between the carousel and the grid.
  getVisibleCards() {
    const out = []
    for (let slot = 0; slot < CONFIG.visibleCount; slot++) {
      const w = this._wraps[slot]
      if (!w.style.opacity || +w.style.opacity < 0.5) continue
      const item = this._slotItems[slot]
      if (!item) continue
      out.push({ id: item.id, rect: this._inners[slot].getBoundingClientRect() })
    }
    return out
  }

  unfocus() {
    this._suppress = false
    const f = this._focus
    if (!f || f.dir === -1) return
    f.fromP = f.p; f.dir = -1; f.start = performance.now(); f.openAt = 0
  }
  isFocused() { return !!this._focus }

  _tickFocus() {
    const f = this._focus
    const raw = Math.min(1, (performance.now() - f.start) / FOCUS_MS)
    const e = easeInOutCubic(raw)
    const p = f.dir === 1 ? f.fromP + (1 - f.fromP) * e : f.fromP * (1 - e)
    f.p = p
    if (f.dir === -1 && raw >= 1) { this._focus = null; this._prevU.fill(-1); return }
    // Handoff: keep the ticker card visible until the React panel's cover has
    // had time to fade in over it, so the swap is seamless (no flicker).
    if (f.dir === 1 && p > 0.995 && !f.openAt) f.openAt = performance.now()
    const handed = f.dir === 1 && f.openAt > 0 && performance.now() - f.openAt > 440
    const h = this._cardH
    const H = this._containerH
    const spacing = 1 / CONFIG.visibleCount
    const fCy = FOCUS_TOP + 0.5 * h * FOCUS_SCALE

    for (let slot = 0; slot < CONFIG.visibleCount; slot++) {
      if (slot === f.slot) {
        const a = f.anchor
        const cy     = a.cy + (fCy - a.cy) * p
        const s      = a.s  + (FOCUS_SCALE - a.s) * p
        const tilt   = a.tilt * (1 - p)
        const squash = a.squash + (1 - a.squash) * p
        const sy     = (s * squash).toFixed(4)
        // Once handed off, hide the ticker card — the scrollable content panel
        // renders its own cover at the same spot and takes over (so the cover
        // scrolls together with the content as one frame).
        const op = handed ? '0' : '1'
        this._wraps[slot].style.transform        = `translate3d(0,${(cy - h * (1 - s) / 2).toFixed(2)}px,0)`
        this._wraps[slot].style.zIndex           = '9000'
        this._wraps[slot].style.opacity          = op
        this._wraps[slot].style.pointerEvents    = 'none'
        this._inners[slot].style.transformOrigin = 'center center'
        this._inners[slot].style.transform       = Math.abs(tilt) > 0.2
          ? `perspective(600px) rotateX(${tilt.toFixed(1)}deg) translate3d(0,${(-0.5 * h * s).toFixed(2)}px,0) scale(${s.toFixed(4)},${sy})`
          : `translate3d(0,${(-0.5 * h * s).toFixed(2)}px,0) scale(${s.toFixed(4)},${sy})`
        continue
      }
      const L = this._layout(this._dist(mod(slot * spacing + this._phase, 1)))
      if (!L.visible) {
        this._wraps[slot].style.opacity       = '0'
        this._wraps[slot].style.pointerEvents = 'none'
        continue
      }
      const exitCy = (L.cy < H * 0.5 ? -h * 1.2 : H + h * 0.5)
      const cy = L.cy + (exitCy - L.cy) * p
      const s  = L.s
      const sy = (s * L.squash).toFixed(4)
      this._wraps[slot].style.transform        = `translate3d(0,${(cy - h * (1 - s) / 2).toFixed(2)}px,0)`
      this._wraps[slot].style.zIndex           = String(L.z)
      this._wraps[slot].style.opacity          = (1 - p).toFixed(3)
      this._wraps[slot].style.pointerEvents    = 'none'
      this._inners[slot].style.transformOrigin = 'center center'
      this._inners[slot].style.transform       = Math.abs(L.tilt) > 0.2
        ? `perspective(600px) rotateX(${L.tilt.toFixed(1)}deg) translate3d(0,${(-0.5 * h * s).toFixed(2)}px,0) scale(${s.toFixed(4)},${sy})`
        : `translate3d(0,${(-0.5 * h * s).toFixed(2)}px,0) scale(${s.toFixed(4)},${sy})`
    }
  }

  _tick() {
    this._rafId = requestAnimationFrame(this._tick.bind(this))
    if (!this._active || !this._geo) return
    if (this._revealStart !== null) { this._tickReveal(); return }
    if (this._focus !== null)       { this._tickFocus();  return }
    if (this._suppress) {
      this._wraps.forEach(w => { w.style.opacity = '0'; w.style.pointerEvents = 'none' })
      return
    }

    const count = this.items.length
    if (count === 0) {
      this._wraps.forEach(w => { w.style.opacity = '0'; w.style.pointerEvents = 'none' })
      return
    }

    if (count === 1) {
      const item = this.items[0]
      const h    = this._cardH
      const L    = this._layout(0)   // single card sits at the active centre
      const s    = L.s
      if (this._slotItems[0] !== item) {
        this._cards[0].style.backgroundImage = `url("${item.cover}")`
        this._tagEls[0].innerHTML = (item.tags || [])
          .map(t => `<span class="ticker-tag">${t}</span>`).join('')
        this._slotItems[0] = item
      }
      this._wraps[0].style.transform     = `translate3d(0,${L.cy - h * (1 - s) / 2}px,0)`
      this._wraps[0].style.zIndex        = String(L.z)
      this._wraps[0].style.opacity       = '1'
      this._wraps[0].style.pointerEvents = 'auto'
      this._inners[0].style.transform    = `translate3d(0,${-0.5 * h * s}px,0) scale(${s})`
      for (let i = 1; i < CONFIG.visibleCount; i++) {
        this._wraps[i].style.opacity      = '0'
        this._wraps[i].style.pointerEvents = 'none'
      }
      return
    }

    if (this._heldKey) {
      this._lastInput = performance.now()
      const dir = (this._heldKey === 'ArrowDown' ? 1 : -1) * this._sign
      if (performance.now() - this._holdStartT > 300) {
        this._target += dir * 0.1 / CONFIG.visibleCount
      }
    }

    // Magnetic snap: once the user stops scrolling for ~1s, ease the phase onto
    // the nearest card step (active card exactly straight) with a slight
    // overshoot/bounce.
    if (!this._snap && this._interacted && !this._heldKey && this._dragState.id === null &&
        performance.now() - this._lastInput > 1000) {
      const aligned = Math.round(this._target * CONFIG.visibleCount) / CONFIG.visibleCount
      if (Math.abs(this._phase - aligned) > 1e-4) {
        this._snap = { from: this._phase, to: aligned, start: performance.now() }
        this._target = aligned
      }
    }

    if (this._snap) {
      const t = Math.min(1, (performance.now() - this._snap.start) / SNAP_MS)
      this._phase = this._snap.from + (this._snap.to - this._snap.from) * easeOutBack(t)
      if (t >= 1) { this._phase = this._snap.to; this._snap = null }
    } else {
      const prevTick = Math.floor(this._phase * count)
      this._phase = this._phase + (this._target - this._phase) * CONFIG.smoothing
      if (!this._interacted) this._target += this._sign * CONFIG.autoplay
      if (this._interacted) {
        const newTick = Math.floor(this._phase * count)
        if (newTick !== prevTick) this._playTick()
      }
    }

    const spacing = 1 / CONFIG.visibleCount
    const h       = this._cardH
    const VC      = CONFIG.visibleCount

    // ── Pass 1: advance items + wrap bookkeeping, store each slot's u ──────────
    const slotU       = new Float64Array(VC)
    const slotWrapped = new Uint8Array(VC)

    for (let slot = 0; slot < VC; slot++) {
      const u     = mod(slot * spacing + this._phase, 1)
      const prevU = this._prevU[slot]
      this._prevU[slot] = u
      slotU[slot] = u

      if (count > VC && prevU >= 0 && Math.abs(u - prevU) > 0.5) {
        if (u < prevU - 0.5) this._wrapCount[slot]++
        else                  this._wrapCount[slot]--
        slotWrapped[slot] = 1
      }

      const item = this.items[mod(slot + this._wrapCount[slot], count)]
      if (this._slotItems[slot] !== item) {
        this._cards[slot].style.backgroundImage = `url("${item.cover}")`
        this._tagEls[slot].innerHTML = (item.tags || [])
          .map(t => `<span class="ticker-tag">${t}</span>`).join('')
        this._slotItems[slot] = item
      }
    }

    // ── Pass 2: place every card by its signed distance from the active one ────
    // dist = 0 → centred & frontal; dist < 0 → tail (behind/above, smaller);
    // dist > 0 → foreground (in front/below, larger, tilted toward viewer).
    for (let slot = 0; slot < VC; slot++) {
      // Item just swapped under this slot — hide for one frame to avoid a flash.
      if (slotWrapped[slot]) {
        this._wraps[slot].style.opacity       = '0'
        this._wraps[slot].style.pointerEvents = 'none'
        continue
      }

      const dist = this._dist(slotU[slot])
      const L    = this._layout(dist)

      if (!L.visible) {
        this._wraps[slot].style.opacity       = '0'
        this._wraps[slot].style.pointerEvents = 'none'
        continue
      }

      // Every card uses the same centre-pivot transform — a single continuous
      // path, so the active never "snaps" into a different render mode. The
      // foreground's forward flip (negative tilt) makes its top edge grow toward
      // the viewer and its bottom edge shrink away: the card falls onto us.
      const s  = L.s
      const sy = (s * L.squash).toFixed(4)
      this._wraps[slot].style.transform     = `translate3d(0,${(L.cy - h * (1 - s) / 2).toFixed(2)}px,0)`
      this._wraps[slot].style.zIndex        = String(L.z)
      this._wraps[slot].style.opacity       = L.op.toFixed(3)
      this._wraps[slot].style.pointerEvents = L.op > 0.5 ? 'auto' : 'none'
      this._inners[slot].style.transform    = Math.abs(L.tilt) > 0.2
        ? `perspective(600px) rotateX(${L.tilt.toFixed(1)}deg) translate3d(0,${(-0.5 * h * s).toFixed(2)}px,0) scale(${s.toFixed(4)},${sy})`
        : `translate3d(0,${(-0.5 * h * s).toFixed(2)}px,0) scale(${s.toFixed(4)},${sy})`
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  _stopAutoplay() {
    this._interacted = true
    this._lastInput  = performance.now()
    this._snap       = null
    if (!this._audioCtx) { try { this._initAudio() } catch {} }
  }

  _onKeyDown = (e) => {
    if (!this._active || this._focus) return
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    this._stopAutoplay()
    if (this._heldKey === e.key) return
    this._heldKey    = e.key
    this._holdStartT = performance.now()
    const dir = (e.key === 'ArrowDown' ? 1 : -1) * this._sign
    this._target += dir / CONFIG.visibleCount
  }

  _onKeyUp = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') this._heldKey = null
  }

  _onWheel = (e) => {
    if (!this._active || this._focus) return
    e.preventDefault()
    this._stopAutoplay()
    const dy = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    this._target += dy * CONFIG.speedPerPixel * CONFIG.wheel
  }

  _dragState = { id: null, lastY: null, startY: null, startTarget: null, dragged: false }

  _onPointerDown = (e) => {
    if (!this._active || this._focus || this._dragState.id !== null) return
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
    this._lastInput = performance.now()
    this._snap      = null
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
          if (item) { this._startFocus(slotIdx, item); this.onSelect(item) }
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
    document.addEventListener('keydown',             this._onKeyDown)
    document.addEventListener('keyup',               this._onKeyUp)
  }

  _unbindEvents() {
    this.container.removeEventListener('wheel',         this._onWheel)
    this.container.removeEventListener('pointerdown',   this._onPointerDown)
    this.container.removeEventListener('pointermove',   this._onPointerMove)
    this.container.removeEventListener('pointerup',     this._onPointerEnd)
    this.container.removeEventListener('pointercancel', this._onPointerEnd)
    document.removeEventListener('keydown',             this._onKeyDown)
    document.removeEventListener('keyup',               this._onKeyUp)
  }
}
