import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import './style.css';

const canvas = document.querySelector('#twin-canvas');
const outputs = {
  lid: document.querySelector('#lid-angle-output'),
  pitch: document.querySelector('#pitch-output'),
  roll: document.querySelector('#roll-output'),
  sampleRate: document.querySelector('#sample-rate-output'),
  packet: document.querySelector('#packet-output'),
  key: document.querySelector('#key-output'),
  metricLid: document.querySelector('#metric-lid'),
  metricLevel: document.querySelector('#metric-level'),
  metricOrientation: document.querySelector('#metric-orientation'),
  connection: document.querySelector('#connection-state'),
};

const state = { lid: 90, pitch: 0, roll: 0, yaw: 0, source: '等待本机传感器', sampleRate: 0, packetCount: 0, hasReading: false };
const DEG = THREE.MathUtils.degToRad;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#07111f');
scene.fog = new THREE.Fog('#07111f', 14, 29);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(8.4, 5.7, -9.3);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.35, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 6;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.49;

const world = new THREE.Group();
scene.add(world);

const material = {
  body: new THREE.MeshPhysicalMaterial({ color: '#9baab8', roughness: 0.23, metalness: 0.83 }),
  dark: new THREE.MeshStandardMaterial({ color: '#111a27', roughness: 0.47, metalness: 0.25 }),
  display: new THREE.MeshStandardMaterial({ color: '#0b2637', roughness: 0.18, metalness: 0.2, emissive: '#0a4564', emissiveIntensity: 0.4 }),
  key: new THREE.MeshStandardMaterial({ color: '#2a3542', roughness: 0.62, metalness: 0.08 }),
  keyActive: new THREE.MeshStandardMaterial({ color: '#20a99e', roughness: 0.3, metalness: 0.2, emissive: '#1cc7b8', emissiveIntensity: 1.4 }),
  accent: new THREE.MeshStandardMaterial({ color: '#37d7c5', roughness: 0.25, metalness: 0.2, emissive: '#0b897d', emissiveIntensity: 0.55 }),
};

function roundedBox(width, height, depth, radius, meshMaterial) {
  return new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 4, radius), meshMaterial);
}

const keyboardKeys = new Map();

const keyboardRows = [
  [
    ['Escape', 'esc', 1.45], ['F1', '☀−\nF1'], ['F2', '☀+\nF2'], ['F3', '▦\nF3'], ['F4', '⌕\nF4'],
    ['F5', '◉\nF5'], ['F6', '☾\nF6'], ['F7', '◀◀\nF7'], ['F8', '▶❙❙\nF8'], ['F9', '▶▶\nF9'],
    ['F10', '✕♪\nF10'], ['F11', '♪−\nF11'], ['F12', '♪+\nF12'], [null, '◉', 1.1],
  ],
  [
    ['Backquote', '~\n`'], ['Digit1', '!\n1'], ['Digit2', '@\n2'], ['Digit3', '#\n3'], ['Digit4', '$\n4'],
    ['Digit5', '%\n5'], ['Digit6', '^\n6'], ['Digit7', '&\n7'], ['Digit8', '*\n8'], ['Digit9', '(\n9'],
    ['Digit0', ')\n0'], ['Minus', '_\n−'], ['Equal', '+\n='], ['Backspace', 'delete', 1.5],
  ],
  [
    ['Tab', 'tab', 1.5], ['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'], ['KeyR', 'R'],
    ['KeyT', 'T'], ['KeyY', 'Y'], ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'],
    ['KeyP', 'P'], ['BracketLeft', '{\n['], ['BracketRight', '}\n]'], ['Backslash', '|\n\\'],
  ],
  [
    ['CapsLock', 'caps lock', 1.75], ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'],
    ['KeyG', 'G'], ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'],
    ['Semicolon', ':\n;'], ['Quote', '"\n\''], ['Enter', 'return', 2],
  ],
  [
    ['ShiftLeft', 'shift', 2.25], ['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyV', 'V'],
    ['KeyB', 'B'], ['KeyN', 'N'], ['KeyM', 'M'], ['Comma', '<\n,'], ['Period', '>\n.'],
    ['Slash', '?\n/'], ['ShiftRight', 'shift', 2.6],
  ],
  [
    ['Fn', '◎\nfn'], ['ControlLeft', '⌃\ncontrol'], ['AltLeft', '⌥\noption'], ['MetaLeft', '⌘\ncommand', 1.25],
    ['Space', '', 5.6], ['MetaRight', '⌘\ncommand', 1.25], ['AltRight', '⌥\noption'],
    [null, '__ARROW_CLUSTER__', 3],
  ],
];

function makeKeyLabel(label, width, depth) {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 128;
  const context = labelCanvas.getContext('2d');
  context.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
  context.fillStyle = '#d8e5eb';
  const lines = label.split('\n');
  const longestLine = Math.max(...lines.map((line) => line.length));
  const fontSize = lines.length > 1
    ? (longestLine > 6 ? 21 : longestLine > 3 ? 25 : 31)
    : (longestLine > 6 ? 26 : longestLine > 3 ? 32 : 48);
  context.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  if (lines.length === 1) {
    context.fillText(lines[0], 128, 65);
  } else {
    const lineHeight = fontSize * 1.18;
    const firstY = 65 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => context.fillText(line, 128, firstY + index * lineHeight));
  }
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const labelMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.82, depth * 0.72), labelMaterial);
  labelMesh.rotation.x = -Math.PI / 2;
  return labelMesh;
}

function addKeyboard(machine) {
  const keyboard = new THREE.Group();
  const unit = 0.315;
  const gap = 0.043;
  const keyDepth = 0.235;
  const firstRowZ = 1.27;
  const rowStep = 0.315;

  function addKey(code, label, width, x, z, depth = keyDepth) {
    const keyMesh = roundedBox(width - 0.012, 0.055, depth, Math.min(0.035, depth * 0.28), material.key);
    keyMesh.position.set(x, 0.607, z);
    keyMesh.castShadow = true;
    keyboard.add(keyMesh);

    const labelMesh = makeKeyLabel(label, width, depth);
    labelMesh.position.set(x, 0.638, z);
    keyboard.add(labelMesh);

    keyMesh.userData = { code, label: label.replaceAll('\n', ' ') || 'space', labelMesh };
    if (code) keyboardKeys.set(code, keyMesh);
  }

  keyboardRows.forEach((row, rowIndex) => {
    const normalized = row.map(([code, label, units = 1]) => ({ code, label, units }));
    const totalWidth = normalized.reduce((sum, key) => sum + key.units * unit, 0) + (normalized.length - 1) * gap;
    let cursor = -totalWidth / 2;
    normalized.forEach(({ code, label, units }) => {
      const width = units * unit;
      // The default camera observes the keyboard from the MacBook user's
      // side (-Z), where screen-left maps to world +X. Mirror positions only
      // (not the meshes) so the ANSI order is correct and legends stay readable.
      const x = -(cursor + width / 2);
      const z = firstRowZ - rowIndex * rowStep;

      if (label === '__ARROW_CLUSTER__') {
        const arrowWidth = unit;
        const leftX = -(cursor + arrowWidth / 2);
        const middleX = -(cursor + arrowWidth + gap + arrowWidth / 2);
        const rightX = -(cursor + 2 * (arrowWidth + gap) + arrowWidth / 2);
        const verticalGap = 0.021;
        const halfDepth = (keyDepth - verticalGap) / 2;
        const halfOffset = (halfDepth + verticalGap) / 2;
        addKey('ArrowLeft', '◀', arrowWidth, leftX, z);
        addKey('ArrowUp', '▲', arrowWidth, middleX, z + halfOffset, halfDepth);
        addKey('ArrowDown', '▼', arrowWidth, middleX, z - halfOffset, halfDepth);
        addKey('ArrowRight', '▶', arrowWidth, rightX, z);
      } else {
        addKey(code, label, width, x, z);
      }
      cursor += width + gap;
    });
  });
  machine.add(keyboard);
}

function addMacBook() {
  const machine = new THREE.Group();
  machine.position.y = 0.12;
  world.add(machine);

  const base = roundedBox(5.8, 0.23, 3.83, 0.13, material.body);
  base.position.y = 0.43;
  base.castShadow = true;
  base.receiveShadow = true;
  machine.add(base);

  const keyboardDeck = roundedBox(5.53, 0.035, 3.48, 0.06, material.dark);
  keyboardDeck.position.set(0, 0.56, -0.08);
  machine.add(keyboardDeck);

  addKeyboard(machine);

  const trackpad = roundedBox(2.4, 0.025, 1.13, 0.07, new THREE.MeshStandardMaterial({ color: '#607383', roughness: 0.42, metalness: 0.5 }));
  trackpad.position.set(0, 0.585, -1.07);
  machine.add(trackpad);

  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 4.96, 20), material.dark);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 0.64, 1.67);
  machine.add(hinge);

  const lid = new THREE.Group();
  lid.position.set(0, 0.64, 1.67);
  machine.add(lid);

  const frame = roundedBox(5.8, 3.63, 0.17, 0.13, material.body);
  frame.position.set(0, 1.77, 0.02);
  frame.castShadow = true;
  lid.add(frame);

  const bezel = roundedBox(5.5, 3.34, 0.035, 0.045, new THREE.MeshStandardMaterial({ color: '#090f18', roughness: 0.36, metalness: 0.18 }));
  bezel.position.set(0, 1.77, -0.083);
  lid.add(bezel);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.29, 3.12), material.display);
  screen.position.set(0, 1.77, -0.105);
  screen.rotation.y = Math.PI;
  lid.add(screen);

  const cameraDot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), material.dark);
  cameraDot.position.set(0, 3.21, -0.118);
  lid.add(cameraDot);

  const axis = new THREE.Group();
  axis.position.set(-3.55, 0.65, 0);
  machine.add(axis);
  const axisParts = [
    { color: '#fa6576', dir: new THREE.Vector3(1, 0, 0), label: 'X' },
    { color: '#5bd5a8', dir: new THREE.Vector3(0, 1, 0), label: 'Y' },
    { color: '#6aa4ff', dir: new THREE.Vector3(0, 0, 1), label: 'Z' },
  ];
  axisParts.forEach(({ color, dir }) => {
    const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(), 0.58, color, 0.14, 0.08);
    axis.add(arrow);
  });

  return { machine, lid };
}

const mac = addMacBook();

function setKeyActive(code, active) {
  const keyMesh = keyboardKeys.get(code);
  if (!keyMesh) return false;
  keyMesh.material = active ? material.keyActive : material.key;
  keyMesh.position.y = active ? 0.594 : 0.607;
  keyMesh.userData.labelMesh.position.y = active ? 0.625 : 0.638;
  return true;
}

window.addEventListener('keydown', (event) => {
  const mapped = setKeyActive(event.code, true);
  outputs.key.textContent = mapped ? `${keyMeshLabel(event.code)} · ${event.code}` : `${event.code} · 未映射`;
});

window.addEventListener('keyup', (event) => {
  setKeyActive(event.code, false);
});

window.addEventListener('blur', () => {
  keyboardKeys.forEach((_, code) => setKeyActive(code, false));
});

function keyMeshLabel(code) {
  return keyboardKeys.get(code)?.userData.label ?? code;
}

const desk = new THREE.Mesh(
  new THREE.PlaneGeometry(26, 26),
  new THREE.MeshStandardMaterial({ color: '#102133', roughness: 0.95, metalness: 0.05 }),
);
desk.rotation.x = -Math.PI / 2;
desk.receiveShadow = true;
scene.add(desk);

const grid = new THREE.GridHelper(22, 22, '#1e5067', '#163244');
grid.position.y = 0.012;
grid.material.opacity = 0.44;
grid.material.transparent = true;
scene.add(grid);

const halo = new THREE.Mesh(
  new THREE.RingGeometry(3.6, 3.67, 96),
  new THREE.MeshBasicMaterial({ color: '#2ad7c3', transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
);
halo.rotation.x = -Math.PI / 2;
halo.position.y = 0.02;
scene.add(halo);

const ambient = new THREE.HemisphereLight('#b6d4ff', '#07111f', 1.4);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight('#c8e4ff', 3.2);
keyLight.position.set(4.8, 7.5, 4.2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
scene.add(keyLight);
const rimLight = new THREE.PointLight('#24d8c6', 16, 12, 2);
rimLight.position.set(-5, 3.5, -2.5);
scene.add(rimLight);

function setSource(label, connected = false) {
  state.source = label;
  outputs.connection.classList.toggle('connected', connected);
  outputs.connection.querySelector('span').textContent = label;
}

function updateReadout() {
  if (!state.hasReading) return;
  outputs.lid.textContent = `${state.lid.toFixed(1)}°`;
  outputs.pitch.textContent = `${state.pitch.toFixed(1)}°`;
  outputs.roll.textContent = `${state.roll.toFixed(1)}°`;
  outputs.sampleRate.textContent = `${state.sampleRate.toFixed(0)} Hz`;
  outputs.packet.textContent = `#${state.packetCount}`;
}

function updateTelemetry() {
  if (!state.hasReading) return;
  outputs.metricLid.textContent = `${state.lid.toFixed(1)}°`;
  outputs.metricLevel.textContent = `${Math.hypot(state.pitch, state.roll).toFixed(1)}°`;
  const deviation = Math.hypot(state.pitch, state.roll);
  outputs.metricOrientation.textContent = deviation < 2 ? '稳定' : deviation < 10 ? '轻微倾斜' : '姿态变化';
}

function ingest(next, source = '本机传感器') {
  ['lid', 'pitch', 'roll', 'yaw'].forEach((key) => {
    if (next[key] !== null && next[key] !== undefined && Number.isFinite(Number(next[key]))) {
      state[key] = Number(next[key]);
    }
  });
  if (Number.isFinite(Number(next.sampleRate))) state.sampleRate = Number(next.sampleRate);
  state.packetCount += 1;
  state.hasReading = true;
  setSource(source, true);
  updateReadout();
}

document.querySelector('#reset-button').addEventListener('click', () => {
  controls.reset();
  camera.position.set(8.4, 5.7, -9.3);
  controls.target.set(0, 1.35, 0);
});

document.querySelector('#sensor-button').addEventListener('click', () => {
  const button = document.querySelector('#sensor-button');
  button.textContent = '正在连接…';
  try {
    const socket = new WebSocket('ws://127.0.0.1:8765');
    socket.onopen = () => {
      button.textContent = '本机传感器已连接';
      setSource('本地传感器', true);
    };
    socket.onmessage = async ({ data }) => {
      let payload;
      try {
        let text;
        if (typeof data === 'string') {
          text = data;
        } else if (data instanceof Blob) {
          text = await data.text();
        } else if (data instanceof ArrayBuffer) {
          text = new TextDecoder().decode(data);
        } else {
          throw new TypeError(`Unsupported WebSocket payload: ${Object.prototype.toString.call(data)}`);
        }
        payload = JSON.parse(text);
        if (!payload || typeof payload !== 'object') throw new TypeError('Sensor payload is not an object');
      } catch (error) {
        console.error('Sensor payload decode failed:', error, data);
        setSource('传感器数据格式错误', false);
        return;
      }
      try {
        // Bridge v3 reports chassis coordinates directly. Older bridge
        // versions exposed the SPU's X/Y tilt channels as pitch/roll in the
        // opposite order, so swap them here for backward compatibility.
        const chassisAxes = payload.axisConvention === 'macbook-chassis-v2';
        ingest({
          lid: payload.lidAngle,
          pitch: chassisAxes ? payload.pitch : payload.roll,
          roll: chassisAxes ? payload.roll : -payload.pitch,
          yaw: payload.yaw,
          sampleRate: payload.sampleRate,
        });
      } catch (error) {
        console.error('Sensor UI update failed:', error, payload);
        setSource('界面更新错误', false);
      }
    };
    socket.onerror = () => {
      button.textContent = '传感器桥不可用';
      setSource('传感器桥不可用', false);
    };
  } catch {
    button.textContent = '传感器桥不可用';
  }
});

function resize() {
  const { clientWidth, clientHeight } = canvas.parentElement;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight, false);
}
window.addEventListener('resize', resize);
resize();

function render() {
  // 0° is closed, 90° is vertical, and larger angles lean away from the user.
  mac.lid.rotation.x = DEG(state.lid - 90);
  mac.machine.rotation.set(DEG(state.pitch), DEG(state.yaw), DEG(state.roll), 'YXZ');
  updateReadout();
  updateTelemetry();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

window.addEventListener('message', ({ data }) => {
  if (data?.type === 'mbp-sensor') ingest(data);
});

document.querySelector('#sensor-button').click();
