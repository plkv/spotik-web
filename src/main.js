import { PLAYLISTS } from './data/playlists.js'
import { TapeView }  from './views/tape.js'
import { GridView }  from './views/grid.js'
import { Overlay }   from './overlay.js'
import { Filters }   from './filters.js'
import { getHash, onHashChange } from './router.js'

// ── Elements ──────────────────────────────────────────────────────────────────
const tickerContainer = document.getElementById('ticker')
const filterBar       = document.getElementById('filter-bar')
const btnTape         = document.getElementById('btn-tape')
const btnGrid         = document.getElementById('btn-grid')

// ── State ─────────────────────────────────────────────────────────────────────
let viewMode = 'tape'
let filtered = [...PLAYLISTS]

// ── Modules ───────────────────────────────────────────────────────────────────
const overlay = new Overlay()

const tape = new TapeView(tickerContainer, filtered, {
  onSelect: p => overlay.open(p),
})

const grid = new GridView(tickerContainer, filtered, {
  onSelect: p => overlay.open(p),
})

const filters = new Filters(filterBar, PLAYLISTS, {
  onChange: items => {
    filtered = items
    tape.setItems(items)
    grid.setItems(items)
  },
})

// ── View toggle ───────────────────────────────────────────────────────────────
function setView(mode) {
  viewMode = mode
  btnTape.classList.toggle('active', mode === 'tape')
  btnGrid.classList.toggle('active', mode === 'grid')

  if (mode === 'tape') {
    tape.show()
    grid.hide()
    tickerContainer.style.overflow = 'hidden'
    tickerContainer.style.touchAction = 'none'
  } else {
    tape.hide()
    grid.show()
    tickerContainer.style.overflow = 'hidden'
    tickerContainer.style.touchAction = 'pan-y'
  }
}

btnTape.addEventListener('click', () => setView('tape'))
btnGrid.addEventListener('click', () => setView('grid'))

// ── Hash routing ──────────────────────────────────────────────────────────────
const initialHash = getHash()
if (initialHash) overlay.openById(initialHash, PLAYLISTS)

onHashChange(id => {
  if (id) overlay.openById(id, PLAYLISTS)
  else overlay.close()
})

// ── Init ──────────────────────────────────────────────────────────────────────
setView('tape')
