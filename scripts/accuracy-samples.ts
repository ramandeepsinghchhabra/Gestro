import type { Gesture, LandmarkPoint } from '../src/content/recognizer';

export interface AccuracySample {
  label: Gesture;
  description: string;
  landmarks: LandmarkPoint[];
  brightness: number | null;
}

const WRIST = { x: 0.50, y: 0.92, z: 0 };
const THUMB_MCP = { x: 0.40, y: 0.80, z: 0 };
const INDEX_MCP = { x: 0.48, y: 0.75, z: 0 };
const INDEX_PIP = { x: 0.48, y: 0.67, z: 0 };
const MIDDLE_MCP = { x: 0.52, y: 0.74, z: 0 };
const MIDDLE_PIP = { x: 0.52, y: 0.66, z: 0 };
const RING_MCP = { x: 0.56, y: 0.75, z: 0 };
const RING_PIP = { x: 0.56, y: 0.68, z: 0 };
const PINKY_MCP = { x: 0.60, y: 0.78, z: 0 };
const PINKY_PIP = { x: 0.60, y: 0.72, z: 0 };

const gestureTemplates: Record<Exclude<Gesture, 'NONE'>, { thumbExtended: boolean; indexExtended: boolean; middleExtended: boolean; ringExtended: boolean; pinkyExtended: boolean; } > = {
  NEXT: { thumbExtended: false, indexExtended: true, middleExtended: false, ringExtended: false, pinkyExtended: false },
  PREV: { thumbExtended: false, indexExtended: true, middleExtended: true, ringExtended: false, pinkyExtended: false },
  SPEED: { thumbExtended: false, indexExtended: true, middleExtended: true, ringExtended: true, pinkyExtended: false },
  PAUSE: { thumbExtended: false, indexExtended: true, middleExtended: true, ringExtended: true, pinkyExtended: true },
  EXIT: { thumbExtended: true, indexExtended: true, middleExtended: true, ringExtended: true, pinkyExtended: true },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function jitterPoint(point: LandmarkPoint, magnitude = 0.02): LandmarkPoint {
  return {
    x: clamp(point.x + (Math.random() - 0.5) * magnitude, 0, 1),
    y: clamp(point.y + (Math.random() - 0.5) * magnitude, 0, 1),
    z: point.z,
  };
}

function makeThumbTip(extended: boolean): LandmarkPoint {
  if (extended) {
    return { x: 0.12, y: 0.72, z: 0 };
  }
  return { x: 0.46, y: 0.86, z: 0 };
}

function makeFinger(extended: boolean, mcp: LandmarkPoint, pip: LandmarkPoint): { tip: LandmarkPoint; pip: LandmarkPoint; mcp: LandmarkPoint } {
  const tip = extended
    ? { x: mcp.x, y: mcp.y - 0.18, z: 0 }
    : { x: mcp.x, y: pip.y + 0.12, z: 0 };
  return { tip, pip, mcp };
}

function makeLandmarks(template: { thumbExtended: boolean; indexExtended: boolean; middleExtended: boolean; ringExtended: boolean; pinkyExtended: boolean }): LandmarkPoint[] {
  const thumbTip = makeThumbTip(template.thumbExtended);
  const thumbIp = { x: (THUMB_MCP.x + thumbTip.x) / 2, y: (THUMB_MCP.y + thumbTip.y) / 2, z: 0 };
  const thumbCmc = { x: (WRIST.x + THUMB_MCP.x) / 2, y: (WRIST.y + THUMB_MCP.y) / 2, z: 0 };

  const index = makeFinger(template.indexExtended, INDEX_MCP, INDEX_PIP);
  const middle = makeFinger(template.middleExtended, MIDDLE_MCP, MIDDLE_PIP);
  const ring = makeFinger(template.ringExtended, RING_MCP, RING_PIP);
  const pinky = makeFinger(template.pinkyExtended, PINKY_MCP, PINKY_PIP);

  const placeholder: LandmarkPoint = { x: WRIST.x, y: WRIST.y + 0.02, z: 0 };
  const landmarks: LandmarkPoint[] = Array.from({ length: 21 }, () => ({ ...placeholder }));

  landmarks[0] = WRIST;
  landmarks[1] = thumbCmc;
  landmarks[2] = THUMB_MCP;
  landmarks[3] = thumbIp;
  landmarks[4] = thumbTip;
  landmarks[5] = INDEX_MCP;
  landmarks[6] = INDEX_PIP;
  landmarks[7] = { x: (INDEX_PIP.x + index.tip.x) / 2, y: (INDEX_PIP.y + index.tip.y) / 2, z: 0 };
  landmarks[8] = index.tip;
  landmarks[9] = MIDDLE_MCP;
  landmarks[10] = MIDDLE_PIP;
  landmarks[11] = { x: (MIDDLE_PIP.x + middle.tip.x) / 2, y: (MIDDLE_PIP.y + middle.tip.y) / 2, z: 0 };
  landmarks[12] = middle.tip;
  landmarks[13] = RING_MCP;
  landmarks[14] = RING_PIP;
  landmarks[15] = { x: (RING_PIP.x + ring.tip.x) / 2, y: (RING_PIP.y + ring.tip.y) / 2, z: 0 };
  landmarks[16] = ring.tip;
  landmarks[17] = PINKY_MCP;
  landmarks[18] = PINKY_PIP;
  landmarks[19] = { x: (PINKY_PIP.x + pinky.tip.x) / 2, y: (PINKY_PIP.y + pinky.tip.y) / 2, z: 0 };
  landmarks[20] = pinky.tip;

  return landmarks.map((point) => jitterPoint(point, 0.015));
}

function makeSample(label: Exclude<Gesture, 'NONE'>): AccuracySample {
  return {
    label,
    description: `${label} template with slight real-world jitter`,
    landmarks: makeLandmarks(gestureTemplates[label]),
    brightness: 0.65,
  };
}

export function loadAccuracySamples(): AccuracySample[] {
  const samples: AccuracySample[] = [];
  const gestures: Array<Exclude<Gesture, 'NONE'>> = ['NEXT', 'PREV', 'SPEED', 'PAUSE', 'EXIT'];

  for (const gesture of gestures) {
    for (let i = 0; i < 100; i += 1) {
      samples.push(makeSample(gesture));
    }
  }

  return samples;
}
