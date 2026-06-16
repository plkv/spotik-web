export function getHash() {
  return location.hash.slice(1) || null
}

export function setHash(id) {
  history.pushState(null, '', id ? `#${id}` : location.pathname)
}

export function onHashChange(cb) {
  window.addEventListener('hashchange', () => cb(getHash()))
  window.addEventListener('popstate',   () => cb(getHash()))
}
