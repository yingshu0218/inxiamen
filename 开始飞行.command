#!/bin/zsh
set -eu
cd "${0:A:h}"

# Reuse this game's running preview when possible.
if curl -fsS --max-time 1 http://127.0.0.1:5187/ 2>/dev/null | grep -q '鹭岛飞行'; then
  open 'http://127.0.0.1:5187/'
  exit 0
fi
if [[ ! -f dist/index.html ]]; then
  [[ -d node_modules ]] || npm ci --no-audit --no-fund
  npm run build
fi
python3 - <<'PY'
import errno
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import webbrowser

handler = partial(SimpleHTTPRequestHandler, directory="dist")
try:
    server = ThreadingHTTPServer(("127.0.0.1", 5187), handler)
except OSError as error:
    if error.errno != errno.EADDRINUSE:
        raise
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
url = f"http://127.0.0.1:{server.server_port}/"
print(f"鹭岛飞行已就绪。浏览器地址为 {url}，关闭这个终端窗口即可停止。", flush=True)
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
PY
