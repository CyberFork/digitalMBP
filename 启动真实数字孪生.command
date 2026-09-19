#!/bin/zsh
# Double-click this file in Finder to launch the real-sensor Three.js twin.

set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
PYTHON="$ROOT/.venv/bin/python"
BRIDGE="$ROOT/sensor-bridge.py"
WEB_PORT=8786
SENSOR_PORT=8765
RUNTIME_DIR="$ROOT/.runtime"
SENSOR_LOG="$RUNTIME_DIR/sensor-bridge.log"
SENSOR_PID_FILE="$RUNTIME_DIR/sensor-bridge.pid"
WEB_LOG="$RUNTIME_DIR/web-server.log"

mkdir -p "$RUNTIME_DIR"
cd "$ROOT"

echo ""
echo "╭──────────────────────────────────────────╮"
echo "│       Mac Spatial Twin · 真实传感器       │"
echo "╰──────────────────────────────────────────╯"
echo ""

SENSOR_VENDOR="$ROOT/vendor/apple-silicon-accelerometer"
if [[ ! -f "$SENSOR_VENDOR/pyproject.toml" ]]; then
  echo "正在获取 Apple Silicon 传感器依赖…"
  if [[ -d "$ROOT/.git" ]]; then
    git -C "$ROOT" submodule update --init --recursive || exit 1
  else
    mkdir -p "$ROOT/vendor"
    git clone --depth 1 https://github.com/olvvier/apple-silicon-accelerometer.git "$SENSOR_VENDOR" || exit 1
  fi
fi

if [[ ! -x "$PYTHON" ]]; then
  echo "正在首次安装 Python 依赖…"
  python3 -m venv .venv || exit 1
  "$PYTHON" -m pip install -e "$SENSOR_VENDOR" websockets || exit 1
fi

if [[ ! -x "$ROOT/node_modules/.bin/vite" ]]; then
  echo "正在首次安装前端依赖…"
  npm install --cache "$ROOT/.npm-cache" || exit 1
fi

echo "正在构建 Three.js 界面…"
npm run build >/dev/null || exit 1

if ! nc -z 127.0.0.1 "$SENSOR_PORT" >/dev/null 2>&1; then
  echo ""
  echo "需要一次管理员授权以读取 Mac 内置 IMU、铰链角度传感器。"
  echo "只读取传感器；数据仅经 127.0.0.1 传给本机浏览器。"
  sudo -v || exit 1
  sudo -n "$PYTHON" "$BRIDGE" >>"$SENSOR_LOG" 2>&1 &
  SENSOR_PID=$!
  echo "$SENSOR_PID" > "$SENSOR_PID_FILE"
  sleep 1
  if ! nc -z 127.0.0.1 "$SENSOR_PORT" >/dev/null 2>&1; then
    echo "传感器桥启动失败。日志：$SENSOR_LOG"
    echo ""
    tail -20 "$SENSOR_LOG" 2>/dev/null || true
    exit 1
  fi
  echo "传感器桥已启动（PID $SENSOR_PID）。"
else
  echo "检测到已运行的真实传感器桥。"
fi

if ! nc -z 127.0.0.1 "$WEB_PORT" >/dev/null 2>&1; then
  nohup "$PYTHON" -m http.server "$WEB_PORT" --bind 127.0.0.1 --directory "$ROOT/dist" >>"$WEB_LOG" 2>&1 &
  sleep 0.5
fi

URL="http://127.0.0.1:$WEB_PORT"
echo ""
echo "正在浏览器打开：$URL"
open "$URL"
echo ""
echo "已启动。此窗口可以关闭；本地传感器桥和页面服务会继续运行。"
