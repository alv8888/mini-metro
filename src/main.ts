import './style.css';

type StationKind = 'residential' | 'commerce' | 'culture' | 'civic' | 'leisure';
type Passenger = { id: number; destination: string; route: string[] };
type Station = {
  id: string; name: string; x: number; y: number; kind: StationKind;
  queue: Passenger[]; overload: number;
};
type Train = {
  stationIndex: number; direction: 1 | -1; progress: number;
  dwell: number; passengers: Passenger[];
};
type MetroLine = {
  id: number; name: string; color: string; stations: string[]; train: Train | null;
};
type Edge = { to: string };

const WORLD_W = 1200;
const WORLD_H = 760;
const COLORS = ['#e47762', '#5d92bd', '#6a9c81', '#d5a14e'];
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const ctx = canvas.getContext('2d')!;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const stations: Station[] = [
  { id: 'harbor', name: 'Old Harbor', x: 145, y: 355, kind: 'commerce', queue: [], overload: 0 },
  { id: 'gardens', name: 'West Gardens', x: 250, y: 205, kind: 'leisure', queue: [], overload: 0 },
  { id: 'north', name: 'North Quarter', x: 420, y: 130, kind: 'residential', queue: [], overload: 0 },
  { id: 'museum', name: 'Museum Mile', x: 530, y: 285, kind: 'culture', queue: [], overload: 0 },
  { id: 'market', name: 'Central Market', x: 390, y: 440, kind: 'commerce', queue: [], overload: 0 },
  { id: 'civic', name: 'Civic Square', x: 650, y: 445, kind: 'civic', queue: [], overload: 0 },
  { id: 'east', name: 'Eastbank', x: 865, y: 350, kind: 'residential', queue: [], overload: 0 },
  { id: 'university', name: 'University', x: 780, y: 175, kind: 'culture', queue: [], overload: 0 },
  { id: 'stadium', name: 'Grand Stadium', x: 1040, y: 235, kind: 'leisure', queue: [], overload: 0 },
  { id: 'heights', name: 'Hillview', x: 1035, y: 510, kind: 'residential', queue: [], overload: 0 },
  { id: 'clinic', name: 'Riverside Clinic', x: 850, y: 610, kind: 'civic', queue: [], overload: 0 },
  { id: 'south', name: 'South Pier', x: 540, y: 620, kind: 'commerce', queue: [], overload: 0 },
  { id: 'orchard', name: 'Orchard Lane', x: 270, y: 590, kind: 'residential', queue: [], overload: 0 },
  { id: 'airport', name: 'Airfield', x: 1090, y: 100, kind: 'commerce', queue: [], overload: 0 },
];

const lines: MetroLine[] = COLORS.map((color, index) => ({
  id: index, name: `Line ${index + 1}`, color, stations: [], train: null,
}));

let selectedLine = 0;
let passengerId = 1;
let elapsed = 0;
let demandClock = 0;
let score = 0;
let paused = false;
let simulationSpeed = 1;
let capacityLevel = 1;
let expressLevel = 1;
let gameOver = false;
let soundOn = false;
let hoveredStation: Station | null = null;
let lastFrame = 0;
let soundContext: AudioContext | null = null;
let soundMaster: GainNode | null = null;

const stationById = (id: string) => stations.find((station) => station.id === id)!;
const totalWaiting = () => stations.reduce((sum, station) => sum + station.queue.length, 0);
const totalOnTrains = () => lines.reduce((sum, line) => sum + (line.train?.passengers.length ?? 0), 0);
const activeLines = () => lines.filter((line) => line.stations.length >= 2).length;

function graph(): Map<string, Edge[]> {
  const result = new Map<string, Edge[]>();
  for (const station of stations) result.set(station.id, []);
  for (const line of lines) {
    for (let i = 0; i < line.stations.length - 1; i += 1) {
      const a = line.stations[i];
      const b = line.stations[i + 1];
      if (!a || !b) continue;
      result.get(a)?.push({ to: b });
      result.get(b)?.push({ to: a });
    }
  }
  return result;
}

function shortestRoute(start: string, destination: string, network = graph()): string[] | null {
  if (start === destination) return [start];
  const queue: string[] = [start];
  const previous = new Map<string, string | null>([[start, null]]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of network.get(current) ?? []) {
      if (previous.has(edge.to)) continue;
      previous.set(edge.to, current);
      if (edge.to === destination) {
        const path = [destination];
        let cursor: string | null = current;
        while (cursor) {
          path.unshift(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return path;
      }
      queue.push(edge.to);
    }
  }
  return null;
}

function nextTrainStop(line: MetroLine, train: Train): Station | null {
  if (line.stations.length < 2) return null;
  let targetIndex = train.stationIndex + train.direction;
  if (targetIndex < 0 || targetIndex >= line.stations.length) {
    train.direction = train.direction === 1 ? -1 : 1;
    targetIndex = train.stationIndex + train.direction;
  }
  const id = line.stations[targetIndex];
  return id ? stationById(id) : null;
}

function resetTrain(line: MetroLine): void {
  if (line.train) {
    const currentId = line.stations[line.train.stationIndex];
    if (currentId) {
      const currentStation = stationById(currentId);
      currentStation.queue.push(...line.train.passengers);
    }
  }
  line.train = line.stations.length >= 2
    ? { stationIndex: 0, direction: 1, progress: 0, dwell: 0.5, passengers: [] }
    : null;
}

function rebuildRoute(line: MetroLine): void {
  const seen = new Set<string>();
  line.stations = line.stations.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  resetTrain(line);
  updateHUD();
}

function addStationToSelectedLine(station: Station): void {
  const line = lines[selectedLine];
  if (!line || gameOver) return;
  const existingIndex = line.stations.indexOf(station.id);
  if (existingIndex >= 0) {
    line.stations = line.stations.slice(0, existingIndex + 1);
  } else {
    line.stations.push(station.id);
  }
  rebuildRoute(line);
  const hint = $('#start-hint');
  hint.classList.add('hidden');
  $('#map-status').textContent = line.stations.length < 2
    ? 'SELECT ANOTHER STATION TO START SERVICE'
    : `${line.name.toUpperCase()} · ${line.stations.length} STATIONS CONNECTED`;
}

function undoRoute(): void {
  const line = lines[selectedLine];
  if (!line || !line.stations.length || gameOver) return;
  line.stations.pop();
  rebuildRoute(line);
  $('#map-status').textContent = line.stations.length >= 2
    ? `${line.name.toUpperCase()} · ROUTE UPDATED`
    : 'ROUTE CLEARED · SELECT A STATION';
}

function clearRoute(): void {
  const line = lines[selectedLine];
  if (!line || gameOver || !line.stations.length) return;
  line.stations = [];
  rebuildRoute(line);
  $('#map-status').textContent = `${line.name.toUpperCase()} · READY TO BUILD`;
}

function spawnPassenger(): void {
  const network = graph();
  const connected: Array<{ from: Station; to: Station; route: string[] }> = [];
  for (const from of stations) {
    if (from.queue.length >= 16) continue;
    for (const to of stations) {
      if (from.id === to.id || to.queue.length >= 16) continue;
      const route = shortestRoute(from.id, to.id, network);
      if (route && route.length >= 2) connected.push({ from, to, route });
    }
  }
  if (!connected.length) return;
  const options = connected.filter(({ from }) => from.queue.length < 10);
  const choice = (options.length ? options : connected)[Math.floor(Math.random() * (options.length || connected.length))]!;
  choice.from.queue.push({ id: passengerId++, destination: choice.to.id, route: choice.route });
}

function boardPassengers(line: MetroLine, train: Train, station: Station): void {
  const next = nextTrainStop(line, train);
  if (!next || train.passengers.length >= 6 * capacityLevel) return;
  const eligible = station.queue.filter((passenger) => passenger.route[0] === station.id && passenger.route[1] === next.id);
  const seats = 6 * capacityLevel - train.passengers.length;
  const boarding = eligible.slice(0, seats);
  if (!boarding.length) return;
  const boardingIds = new Set(boarding.map((passenger) => passenger.id));
  station.queue = station.queue.filter((passenger) => !boardingIds.has(passenger.id));
  train.passengers.push(...boarding);
}

function arriveAtStation(line: MetroLine, train: Train, station: Station): void {
  const remaining: Passenger[] = [];
  for (const passenger of train.passengers) {
    if (passenger.route[1] === station.id) passenger.route.shift();
    if (passenger.destination === station.id || passenger.route.length <= 1) {
      score += 1;
      continue;
    }
    const next = nextTrainStop(line, train);
    if (next?.id !== passenger.route[1]) {
      station.queue.push(passenger);
      continue;
    }
    remaining.push(passenger);
  }
  train.passengers = remaining;
  boardPassengers(line, train, station);
}

function updateSimulation(dt: number): void {
  if (paused || gameOver) return;
  elapsed += dt;
  demandClock += dt;
  const spawnInterval = Math.max(1.7, 5.2 - elapsed / 150);
  while (demandClock >= spawnInterval) {
    demandClock -= spawnInterval;
    spawnPassenger();
    if (elapsed > 90 && Math.random() < 0.22) spawnPassenger();
  }

  for (const line of lines) {
    const train = line.train;
    if (!train || line.stations.length < 2) continue;
    if (train.dwell > 0) {
      train.dwell = Math.max(0, train.dwell - dt);
      if (train.dwell === 0) {
        const currentId = line.stations[train.stationIndex];
        if (currentId) boardPassengers(line, train, stationById(currentId));
      }
      continue;
    }
    const currentId = line.stations[train.stationIndex];
    const next = nextTrainStop(line, train);
    if (!currentId || !next) continue;
    const current = stationById(currentId);
    const distance = Math.hypot(next.x - current.x, next.y - current.y);
    const travelUnitsPerSecond = 105 * expressLevel;
    train.progress += (dt * travelUnitsPerSecond) / Math.max(1, distance);
    if (train.progress >= 1) {
      train.stationIndex += train.direction;
      train.progress = 0;
      train.dwell = 0.45;
      arriveAtStation(line, train, next);
    }
  }

  for (const station of stations) {
    if (station.queue.length > 12) station.overload += dt;
    else station.overload = Math.max(0, station.overload - dt * 0.7);
    if (station.overload >= 17) endGame(station);
  }

  if (elapsed > 210 && Math.floor(elapsed / 70) % 3 === 0) {
    $('#event-title').textContent = 'Evening return';
    $('#event-copy').textContent = 'Commuters are heading back across the city.';
  } else if (elapsed > 95) {
    $('#event-title').textContent = 'City getting busier';
    $('#event-copy').textContent = 'Demand is rising. Keep transfer stations moving.';
  }
}

function endGame(station: Station): void {
  if (gameOver) return;
  gameOver = true;
  paused = true;
  $('#game-over-copy').textContent = `${station.name} stayed overcrowded for too long. The city needs more capacity or a better connection.`;
  $('#final-score').textContent = String(score).padStart(3, '0');
  $('#game-over').classList.remove('hidden');
  $('#pause-button').innerHTML = '<span>▶</span> Resume';
  $('#map-status').textContent = 'SERVICE INTERRUPTED · NETWORK OVERLOAD';
  updateHUD();
}

function drawBackground(): void {
  ctx.fillStyle = '#e9ece5';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Quiet city blocks: visual texture only, deliberately not a detailed city-builder.
  const blocks = [
    [30, 35, 155, 95], [210, 32, 145, 90], [390, 25, 125, 63], [565, 40, 145, 80],
    [760, 30, 160, 80], [960, 35, 190, 82], [40, 500, 130, 88], [405, 535, 100, 58],
    [680, 565, 115, 75], [930, 640, 170, 55], [200, 680, 145, 45], [1020, 385, 125, 72],
  ];
  for (let i = 0; i < blocks.length; i += 1) {
    const [x, y, w, h] = blocks[i]!;
    ctx.fillStyle = i % 3 === 0 ? '#dfe5dc' : '#e2e7df';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 9);
    ctx.fill();
    ctx.strokeStyle = '#d6ddd4';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let j = 0; j < 3; j += 1) {
      ctx.fillStyle = '#d3dbd2';
      ctx.fillRect(x + 15 + j * 35, y + 14, 17, 5);
    }
  }

  // Parks and water give the map a recognizable geography.
  ctx.fillStyle = '#d3e0d3';
  ctx.beginPath();
  ctx.roundRect(210, 250, 205, 105, 28);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(900, 545, 150, 85, 22);
  ctx.fill();

  ctx.fillStyle = '#d4e4e4';
  ctx.beginPath();
  ctx.moveTo(1100, 0);
  ctx.lineTo(1200, 0);
  ctx.lineTo(1200, 760);
  ctx.lineTo(1120, 760);
  ctx.bezierCurveTo(1060, 655, 1140, 550, 1080, 455);
  ctx.bezierCurveTo(1030, 370, 1120, 265, 1050, 170);
  ctx.bezierCurveTo(1010, 110, 1060, 45, 1100, 0);
  ctx.fill();

  ctx.strokeStyle = '#c8d9da';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1090, 0);
  ctx.bezierCurveTo(1050, 95, 1070, 135, 1085, 190);
  ctx.bezierCurveTo(1150, 290, 1060, 375, 1110, 470);
  ctx.bezierCurveTo(1160, 560, 1085, 660, 1132, 760);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(169,181,171,.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 9]);
  for (let x = 25; x < WORLD_W; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke();
  }
  for (let y = 25; y < WORLD_H; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = '#9baa9c';
  ctx.font = '600 10px Inter, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('WEST DISTRICT', 44, 165);
  ctx.fillText('OLD TOWN', 435, 375);
  ctx.fillText('EASTBANK', 900, 315);
  ctx.fillText('SOUTH QUAY', 505, 700);
  ctx.fillText('THE GREEN', 260, 308);
  ctx.letterSpacing = '0px';
}

function drawLine(line: MetroLine): void {
  if (line.stations.length < 2) return;
  const points = line.stations.map(stationById);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.88)';
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();

  ctx.strokeStyle = line.color;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();

  if (line.id === selectedLine) {
    ctx.strokeStyle = 'rgba(255,255,255,.72)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawStation(station: Station): void {
  const lineCount = lines.filter((line) => line.stations.includes(station.id)).length;
  const selected = lines[selectedLine]?.stations.includes(station.id) ?? false;
  const hovered = hoveredStation?.id === station.id;
  const radius = lineCount > 1 ? 13 : 10;

  if (hovered || selected) {
    ctx.beginPath();
    ctx.arc(station.x, station.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = hovered ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.42)';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(station.x, station.y, radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#f7f7f2';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(station.x, station.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = station.overload > 4 ? '#d76d57' : '#344c4a';
  ctx.fill();

  ctx.fillStyle = '#f7f7f2';
  ctx.font = 'bold 9px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const symbols: Record<StationKind, string> = {
    residential: 'H', commerce: '$', culture: '✳', civic: '+', leisure: '◇',
  };
  ctx.fillText(symbols[station.kind], station.x, station.y + 0.5);

  if (station.queue.length > 0) {
    const visible = Math.min(station.queue.length, 8);
    for (let i = 0; i < visible; i += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / Math.max(visible, 1);
      const dotX = station.x + Math.cos(angle) * 22;
      const dotY = station.y + Math.sin(angle) * 22;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3.3, 0, Math.PI * 2);
      ctx.fillStyle = '#f9f8ef';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.fillStyle = station.queue[i]?.id ? '#425d58' : '#fff';
      ctx.fill();
    }
  }

  if (station.overload > 0) {
    ctx.beginPath();
    ctx.arc(station.x, station.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(station.overload / 17, 1));
    ctx.strokeStyle = '#dc8069';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 12px Inter, sans-serif';
  const labelWidth = ctx.measureText(station.name).width;
  const labelX = station.x + 17;
  const labelY = station.y - 15;
  ctx.fillStyle = 'rgba(247,247,242,.86)';
  ctx.beginPath();
  ctx.roundRect(labelX - 5, labelY - 12, labelWidth + 10, 19, 5);
  ctx.fill();
  ctx.fillStyle = '#425451';
  ctx.fillText(station.name, labelX, labelY + 2);
}

function drawTrain(line: MetroLine): void {
  const train = line.train;
  if (!train || line.stations.length < 2) return;
  const current = stationById(line.stations[train.stationIndex]!);
  const next = nextTrainStop(line, train);
  if (!next) return;
  const x = current.x + (next.x - current.x) * train.progress;
  const y = current.y + (next.y - current.y) * train.progress;
  const angle = Math.atan2(next.y - current.y, next.x - current.x);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(30,48,45,.18)';
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#f9f8f1';
  ctx.beginPath();
  ctx.roundRect(-17, -9, 34, 18, 8);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = line.color;
  ctx.beginPath();
  ctx.roundRect(-12, -6, 24, 12, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.fillRect(-7, -4, 5, 4);
  ctx.fillRect(2, -4, 5, 4);
  ctx.restore();

  for (let i = 0; i < Math.min(train.passengers.length, 5); i += 1) {
    ctx.beginPath();
    ctx.arc(x - 8 + i * 4, y - 16, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#405650';
    ctx.fill();
  }
}

function render(): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(width / WORLD_W, 0, 0, height / WORLD_H, 0, 0);
  drawBackground();
  for (const line of lines) drawLine(line);
  for (const station of stations) drawStation(station);
  for (const line of lines) drawTrain(line);
}

function updateHUD(): void {
  $('#score').textContent = String(score).padStart(3, '0');
  $('#in-transit').textContent = String(totalOnTrains());
  $('#waiting').textContent = String(totalWaiting());
  $('#active-lines').textContent = `${activeLines()} / 4`;
  const minutes = 8 * 60 + Math.floor(elapsed * 0.72);
  $('#city-time').textContent = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const connected = activeLines() > 0;
  const queueTotal = totalWaiting();
  const flow = connected ? Math.max(8, Math.min(100, 100 - (queueTotal / Math.max(1, stations.length * 0.85)) * 100)) : 0;
  $('#flow-bar').setAttribute('style', `width:${flow}%`);
  $('#flow-label').textContent = !connected ? 'Waiting for service' : flow > 70 ? 'Smooth connections' : flow > 38 ? 'Building pressure' : 'Network under stress';
  $('#flow-note').textContent = !connected ? 'Connect stations to begin moving passengers.' : `${queueTotal} passengers are waiting across the network.`;
  $('#capacity-state').textContent = `Train capacity ×${capacityLevel}`;
  $('#express-state').textContent = `Train speed ×${expressLevel}`;
  $('#capacity-button').classList.toggle('maxed', capacityLevel >= 3);
  $('#speed-button').classList.toggle('maxed', expressLevel >= 3);
  const picker = $('#line-picker');
  picker.querySelectorAll<HTMLButtonElement>('.line-swatch').forEach((button) => {
    button.classList.toggle('selected', Number(button.dataset.line) === selectedLine);
    const line = lines[Number(button.dataset.line)];
    button.classList.toggle('has-route', (line?.stations.length ?? 0) >= 2);
    const count = button.querySelector('span');
    if (count && line) count.textContent = String(line.stations.length).padStart(2, '0');
  });
}

function selectLine(index: number): void {
  selectedLine = index;
  updateHUD();
  const line = lines[selectedLine];
  $('#map-status').textContent = line?.stations.length
    ? `${line.name.toUpperCase()} SELECTED · ${line.stations.length} STATIONS`
    : `${line?.name.toUpperCase()} SELECTED · CHOOSE YOUR FIRST STATION`;
}

function togglePause(): void {
  if (gameOver) return;
  paused = !paused;
  $('#pause-button').innerHTML = paused ? '<span>▶</span> Resume' : '<span>Ⅱ</span> Pause';
  $('#map-status').textContent = paused ? 'SIMULATION PAUSED' : 'NETWORK RUNNING';
}

function toggleSound(): void {
  if (!soundContext) {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) {
      $('#sound-button').innerHTML = '♫ <span>Audio unavailable</span>';
      return;
    }
    soundContext = new AudioContextClass();
    soundMaster = soundContext.createGain();
    soundMaster.gain.value = 0;
    soundMaster.connect(soundContext.destination);

    const notes = [110, 164.81, 220];
    notes.forEach((frequency, index) => {
      const oscillator = soundContext!.createOscillator();
      const voiceGain = soundContext!.createGain();
      const filter = soundContext!.createBiquadFilter();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      filter.type = 'lowpass';
      filter.frequency.value = 420 + index * 110;
      voiceGain.gain.value = index === 0 ? 0.22 : 0.11;
      oscillator.connect(filter);
      filter.connect(voiceGain);
      voiceGain.connect(soundMaster!);
      oscillator.start();
    });
  }
  soundOn = !soundOn;
  if (soundOn) void soundContext.resume();
  soundMaster!.gain.setTargetAtTime(soundOn ? 0.13 : 0, soundContext.currentTime, 0.7);
  $('#sound-button').innerHTML = soundOn ? '♫ <span>Sound on</span>' : '♫ <span>Sound off</span>';
  $('#sound-button').classList.toggle('active', soundOn);
}

function restartGame(): void {
  for (const station of stations) {
    station.queue = [];
    station.overload = 0;
  }
  for (const line of lines) {
    line.stations = [];
    line.train = null;
  }
  selectedLine = 0;
  passengerId = 1;
  elapsed = 0;
  demandClock = 0;
  score = 0;
  paused = false;
  simulationSpeed = 1;
  capacityLevel = 1;
  expressLevel = 1;
  gameOver = false;
  $('#game-over').classList.add('hidden');
  $('#start-hint').classList.remove('hidden');
  $('#pause-button').innerHTML = '<span>Ⅱ</span> Pause';
  $('#event-title').textContent = 'Morning commute';
  $('#event-copy').textContent = 'The city is starting its day.';
  document.querySelectorAll<HTMLButtonElement>('.speed-button').forEach((button) => button.classList.toggle('active', button.dataset.speed === '1'));
  selectLine(0);
  updateHUD();
}

function gameLoop(timestamp: number): void {
  const rawDt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
  lastFrame = timestamp;
  updateSimulation(rawDt * simulationSpeed);
  render();
  updateHUD();
  requestAnimationFrame(gameLoop);
}

function pointerPosition(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD_W,
    y: ((event.clientY - rect.top) / rect.height) * WORLD_H,
  };
}

function findStationAt(x: number, y: number): Station | null {
  return stations.find((station) => Math.hypot(station.x - x, station.y - y) < 24) ?? null;
}

canvas.addEventListener('pointermove', (event) => {
  const point = pointerPosition(event);
  hoveredStation = findStationAt(point.x, point.y);
  canvas.style.cursor = hoveredStation ? 'pointer' : 'crosshair';
});
canvas.addEventListener('pointerleave', () => { hoveredStation = null; });
canvas.addEventListener('pointerdown', (event) => {
  const point = pointerPosition(event);
  const station = findStationAt(point.x, point.y);
  if (station) addStationToSelectedLine(station);
});

$('#line-picker').addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-line]');
  if (target) selectLine(Number(target.dataset.line));
});
$('#undo-button').addEventListener('click', undoRoute);
$('#clear-button').addEventListener('click', clearRoute);
$('#pause-button').addEventListener('click', togglePause);
$('#sound-button').addEventListener('click', toggleSound);
$('#capacity-button').addEventListener('click', () => {
  if (capacityLevel < 3) capacityLevel += 1;
  updateHUD();
});
$('#speed-button').addEventListener('click', () => {
  if (expressLevel < 3) expressLevel += 1;
  updateHUD();
});
document.querySelectorAll<HTMLButtonElement>('.speed-button').forEach((button) => {
  button.addEventListener('click', () => {
    simulationSpeed = Number(button.dataset.speed) || 1;
    document.querySelectorAll('.speed-button').forEach((item) => item.classList.toggle('active', item === button));
  });
});
$('#help-button').addEventListener('click', () => $('#help-popover').classList.remove('hidden'));
$('#close-help').addEventListener('click', () => $('#help-popover').classList.add('hidden'));
$('#dismiss-hint').addEventListener('click', () => $('#start-hint').classList.add('hidden'));
$('#restart-button').addEventListener('click', restartGame);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault();
    togglePause();
  }
  if (event.key === 'Escape') $('#help-popover').classList.add('hidden');
});

selectLine(0);
updateHUD();
requestAnimationFrame(gameLoop);
