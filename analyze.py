#!/usr/bin/env python3
"""
Анализ библиотеки Spotify.

Первый запуск: тянет все данные, кэширует в cache/.
Повторный запуск: использует кэш — ноль лишних API-вызовов.
Принудительное обновление: --refresh

Вывод в out/:
  playlists.csv         — плейлисты с количеством треков и жанрами
  duplicates.csv        — треки, которые лежат в нескольких плейлистах
  playlist_genres.csv   — топ-жанры по каждому плейлисту
  library.json          — всё одним файлом
"""
import os
import sys
import json
import csv
import time
import argparse
from collections import Counter, defaultdict

from dotenv import load_dotenv
import spotipy
from spotipy.oauth2 import SpotifyOAuth

load_dotenv()

SCOPES = "playlist-read-private playlist-read-collaborative user-library-read"
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR  = os.path.join(BASE_DIR, "cache")
OUT_DIR    = os.path.join(BASE_DIR, "out")
CALL_DELAY = 0.12   # ~8 req/s — хорошо ниже лимита Spotify


# ─── кэш ──────────────────────────────────────────────────────────────────────

def cache_path(key):
    safe = key.replace("/", "_").strip("_")
    return os.path.join(CACHE_DIR, f"{safe}.json")

def cache_read(key):
    p = cache_path(key)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return None

def cache_write(key, data):
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(cache_path(key), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


# ─── API-обёртка ──────────────────────────────────────────────────────────────

def api_call(fn, *args, **kwargs):
    """Один вызов Spotify API с уважением к rate limit.
    При 429 ждём Retry-After, но не больше 60 секунд.
    При 403 возвращаем None (нет доступа — пропускаем).
    """
    for attempt in range(2):
        try:
            result = fn(*args, **kwargs)
            time.sleep(CALL_DELAY)
            return result
        except spotipy.SpotifyException as e:
            if e.http_status == 429:
                retry_after = 5
                if e.headers:
                    try:
                        retry_after = int(e.headers.get("Retry-After", 5))
                    except (ValueError, TypeError):
                        pass
                if retry_after > 60:
                    log(f"  ⛔ rate limit слишком долгий ({retry_after}s). "
                        "Остановись и запусти позже.")
                    sys.exit(1)
                log(f"  ⏳ rate limit, жду {retry_after}s...")
                time.sleep(retry_after)
                continue
            if e.http_status == 403:
                return None
            raise
    return None


# ─── helpers ──────────────────────────────────────────────────────────────────

def log(msg):
    print(msg, flush=True)


def get_client():
    for var in ("SPOTIPY_CLIENT_ID", "SPOTIPY_CLIENT_SECRET", "SPOTIPY_REDIRECT_URI"):
        if not os.getenv(var):
            sys.exit(f"❌ Не задана переменная {var} в .env")
    auth = SpotifyOAuth(
        scope=SCOPES,
        cache_path=os.path.join(BASE_DIR, ".spotify_cache"),
        open_browser=True,
    )
    # retries=0: никакого автоматического backoff — управляем сами в api_call()
    return spotipy.Spotify(auth_manager=auth, requests_timeout=15, retries=0)


def fetch_all_playlists(sp):
    """Список всех плейлистов. Кэшируется целиком."""
    cached = cache_read("__playlists__")
    if cached:
        log(f"  плейлисты из кэша: {len(cached['playlists'])} шт.")
        return cached["playlists"], cached["my_id"]

    me = api_call(sp.current_user)
    my_id = me["id"]
    playlists = []
    results = api_call(sp.current_user_playlists, limit=50)
    while results:
        for pl in results.get("items") or []:
            if pl:
                playlists.append(pl)
        results = api_call(sp.next, results) if results.get("next") else None

    cache_write("__playlists__", {"playlists": playlists, "my_id": my_id})
    log(f"  найдено плейлистов: {len(playlists)} (user: {my_id})")
    return playlists, my_id


def fetch_playlist_tracks(sp, pid, pl_name, refresh=False):
    """Треки плейлиста. Кэшируется по ID плейлиста.
    refresh=True пересчитывает даже если уже есть кэш.
    """
    ckey = f"tracks_{pid}"
    if not refresh:
        cached = cache_read(ckey)
        if cached is not None:
            return cached  # может быть пустым списком (403) — это тоже валидный кэш

    results = api_call(
        sp.playlist_items, pid,
        limit=100,
        additional_types=("track",),
        fields="items(track(id,name,artists(id,name))),next",
    )
    if results is None:
        # 403 — нет доступа; кэшируем пустой список чтобы не пытаться снова
        cache_write(ckey, [])
        return []

    items = []
    while results:
        items.extend(results.get("items") or [])
        results = api_call(sp.next, results) if results.get("next") else None

    cache_write(ckey, items)
    return items


def fetch_artist_genres(sp, artist_ids, refresh=False):
    """Жанры артистов батчами по 50. Кэшируется."""
    ckey = "__artist_genres__"
    if not refresh:
        cached = cache_read(ckey)
        if cached:
            # если новые артисты появились — дополняем
            missing = [a for a in artist_ids if a and a not in cached]
            if not missing:
                return cached
            artist_ids = missing
            genres = cached
        else:
            genres = {}
    else:
        genres = {}

    ids = [a for a in artist_ids if a]
    log(f"  тяну жанры для {len(ids)} артистов...")
    for i in range(0, len(ids), 50):
        batch = ids[i:i + 50]
        result = api_call(sp.artists, batch) or {"artists": []}
        for art in result.get("artists") or []:
            if art:
                genres[art["id"]] = art.get("genres", [])

    cache_write(ckey, genres)
    return genres


def write_csv(path, rows, fields):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})


# ─── main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true",
                        help="Игнорировать кэш и перекачать всё заново")
    args = parser.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    sp = get_client()

    log("→ Тяну список плейлистов...")
    playlists, my_id = fetch_all_playlists(sp)

    if args.refresh:
        log("  ⚠️  --refresh: кэш игнорируется")

    track_to_playlists = defaultdict(list)
    track_meta = {}
    all_artist_ids = set()
    playlist_records = []
    playlist_artist_ids = {}
    skipped = []

    log(f"→ Тяну треки ({len(playlists)} плейлистов)...")
    for idx, pl in enumerate(playlists, 1):
        pid = pl["id"]
        owner = pl.get("owner") or {}
        is_mine = owner.get("id") == my_id
        pl_name = pl.get("name") or "(без названия)"

        items = fetch_playlist_tracks(sp, pid, pl_name, refresh=args.refresh)

        valid = [i for i in items if i.get("track") and (i["track"] or {}).get("id")]
        tracks_total = len(valid)

        # показываем "[кэш]" если данные из кэша, чтобы видеть прогресс
        source = "[кэш] " if not args.refresh and cache_read(f"tracks_{pid}") is not None else ""
        if tracks_total == 0 and not valid:
            skipped.append(pl_name)
            log(f"  [{idx}/{len(playlists)}] {source}{pl_name} — нет доступа/пусто")
        else:
            log(f"  [{idx}/{len(playlists)}] {source}{pl_name} — {tracks_total} треков")

        artist_ids_here = []
        for it in valid:
            tr = it["track"]
            tid = tr["id"]
            track_to_playlists[tid].append(pl_name)
            if tid not in track_meta:
                track_meta[tid] = {
                    "name": tr.get("name", ""),
                    "artists": ", ".join(a["name"] for a in tr.get("artists") or []),
                }
            for a in tr.get("artists") or []:
                if a.get("id"):
                    artist_ids_here.append(a["id"])
                    all_artist_ids.add(a["id"])

        playlist_artist_ids[pid] = artist_ids_here
        playlist_records.append({
            "id": pid,
            "name": pl_name,
            "owner": owner.get("display_name") or owner.get("id", ""),
            "is_mine": is_mine,
            "public": pl.get("public", ""),
            "tracks_total": tracks_total,
            "url": (pl.get("external_urls") or {}).get("spotify", ""),
        })

    log(f"\n→ Жанры...")
    artist_genres = fetch_artist_genres(sp, list(all_artist_ids), refresh=args.refresh)

    for pl in playlist_records:
        pid = pl["id"]
        c = Counter()
        for aid in playlist_artist_ids.get(pid, []):
            for g in artist_genres.get(aid, []):
                c[g] += 1
        top = c.most_common(8)
        pl["top_genres"] = "; ".join(f"{g} ({n})" for g, n in top) or "—"

    dup_records = sorted(
        [
            {
                "track": track_meta[tid]["name"],
                "artists": track_meta[tid]["artists"],
                "count": len(set(pls)),
                "playlists": " | ".join(sorted(set(pls))),
            }
            for tid, pls in track_to_playlists.items()
            if len(set(pls)) > 1
        ],
        key=lambda r: r["count"],
        reverse=True,
    )

    genre_records = [{"playlist": pl["name"], "top_genres": pl["top_genres"]}
                     for pl in playlist_records]

    write_csv(os.path.join(OUT_DIR, "playlists.csv"), playlist_records,
              ["name", "owner", "is_mine", "public", "tracks_total", "top_genres", "url", "id"])
    write_csv(os.path.join(OUT_DIR, "duplicates.csv"), dup_records,
              ["track", "artists", "count", "playlists"])
    write_csv(os.path.join(OUT_DIR, "playlist_genres.csv"), genre_records,
              ["playlist", "top_genres"])
    with open(os.path.join(OUT_DIR, "library.json"), "w", encoding="utf-8") as f:
        json.dump({"playlists": playlist_records, "duplicates": dup_records,
                   "genres": genre_records},
                  f, ensure_ascii=False, indent=2, default=str)

    log(f"\n✅ Готово:")
    log(f"   playlists.csv       — {len(playlist_records)} плейлистов")
    log(f"   duplicates.csv      — {len(dup_records)} треков в нескольких плейлистах")
    log(f"   playlist_genres.csv — жанры")
    log(f"   library.json        — всё вместе")
    if skipped:
        shown = ", ".join(skipped[:5])
        tail = f"... +{len(skipped)-5}" if len(skipped) > 5 else ""
        log(f"   ⚠️  пропущено {len(skipped)}: {shown}{tail}")


if __name__ == "__main__":
    main()
