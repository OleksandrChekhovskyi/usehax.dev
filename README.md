# usehax.dev

Static landing page for [hax](https://github.com/OleksandrChekhovskyi/hax), served via
GitHub Pages at [usehax.dev](https://usehax.dev).

To preview locally:

```sh
python3 -m http.server 8000
```

then open <http://localhost:8000>. If the browser shows a stale page after an edit,
force-reload (Cmd+Shift+R): `http.server` sends no cache headers, so browsers fall back to
heuristic caching.
