import { setHash } from './router.js'

export class Overlay {
  constructor() {
    this._el = document.getElementById('overlay')
    this._bindClose()
  }

  open(playlist) {
    setHash(playlist.id)
    this._render(playlist)
    this._el.classList.add('open')
    document.body.style.overflow = 'hidden'
  }

  close() {
    setHash(null)
    this._el.classList.remove('open')
    document.body.style.overflow = ''
  }

  openById(id, playlists) {
    const p = playlists.find(p => p.id === id)
    if (p) this.open(p)
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _render(p) {
    const spotifyEmbed = `
      <iframe
        src="https://open.spotify.com/embed/playlist/${p.spotifyId}?utm_source=generator"
        width="100%" height="152" frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy">
      </iframe>`

    this._el.querySelector('.overlay-content').innerHTML = `
      <div class="overlay-cover">
        <img src="${p.cover}" alt="${p.title}" loading="lazy">
      </div>
      <div class="overlay-body">
        <h2 class="overlay-title">${p.title}</h2>
        <p class="overlay-desc">${p.description}</p>

        <div class="overlay-tags">
          ${p.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>

        <div class="overlay-artists">
          <span class="overlay-label">Artists</span>
          <p>${p.artists.join(' · ')}</p>
        </div>

        <div class="overlay-spotify">
          ${spotifyEmbed}
        </div>

        <a class="overlay-link" href="${p.spotifyUrl}" target="_blank" rel="noopener">
          Open in Spotify ↗
        </a>
      </div>
    `
  }

  _bindClose() {
    this._el.querySelector('.overlay-close').addEventListener('click', () => this.close())
    this._el.querySelector('.overlay-backdrop').addEventListener('click', () => this.close())
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close() })
  }
}
