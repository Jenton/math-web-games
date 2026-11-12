# Kenney bundle browser (local tool, not part of the game)

Search and shortlist every image in the Kenney All-in-1 bundle. Lives in `tools/`, which `tools/build-site.sh` never deploys.
The generated `out/` folder (manifest and thumbnails) is git-ignored.

```
node tools/kenney-browser/build-manifest.js --thumbs   # first run: scans ~58k images, thumbnails take a while; re-runs skip existing ones
node tools/kenney-browser/serve.js                      # then open http://localhost:8765/
```
Options: `--bundle DIR` (default is the Mac path), `--all` (also 3D assets), `--thumbs` needs `ffmpeg`. Without thumbnails the page shows the originals.
Type words in the search box (all must match the path or pack), filter by category or pack, click the star to shortlist, and "Export shortlist.json" downloads
`{category, pack, path, name, bytes, width, height}` for each starred file. Stars are remembered in the browser (localStorage). The server listens on 127.0.0.1 only.

## Hosting it on the Mac mini (Docker + Tailscale)
The page has no login, so never publish the port to your network: the compose file binds it to `127.0.0.1` and Tailscale carries it to your devices.
```
cd tools/kenney-browser
docker compose build
docker compose run --rm kenney-browser node build-manifest.js --thumbs   # once, writes ./out (re-run if the bundle changes)
docker compose up -d                                                      # restarts itself with Docker Desktop
tailscale serve --bg 8765                                                 # private https://<mac-name>.<tailnet>.ts.net/ for your own devices
```
Set `BUNDLE_DIR` if the bundle is not at the default path. Docker Desktop needs file-sharing access to `/Volumes/JentMini Drive`.
Do not use `tailscale funnel`: that makes it public. Stop it with `docker compose down` and `tailscale serve reset`.
