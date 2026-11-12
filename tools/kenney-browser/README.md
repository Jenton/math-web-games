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
