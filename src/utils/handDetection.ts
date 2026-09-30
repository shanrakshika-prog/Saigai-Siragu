export interface HandLandmarks {
  x: number;
  y: number;
  z: number;
}

export function detectFingerStates(landmarks: HandLandmarks[]): string {
  if (!landmarks || landmarks.length !== 21) {
    return '';
  }

  const fingers = [];

  fingers.push(isThumbUp(landmarks));
  fingers.push(isFingerUp(landmarks, 8, 6));
  fingers.push(isFingerUp(landmarks, 12, 10));
  fingers.push(isFingerUp(landmarks, 16, 14));
  fingers.push(isFingerUp(landmarks, 20, 18));

  return fingers.map(f => f ? '1' : '0').join('');
}

function isThumbUp(landmarks: HandLandmarks[]): boolean {
  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const wrist = landmarks[0];

  const isRight = landmarks[17].x < landmarks[5].x;

  if (isRight) {
    return thumbTip.x > thumbIP.x && thumbTip.x > wrist.x;
  } else {
    return thumbTip.x < thumbIP.x && thumbTip.x < wrist.x;
  }
}

function isFingerUp(landmarks: HandLandmarks[], tipIndex: number, pipIndex: number): boolean {
  return landmarks[tipIndex].y < landmarks[pipIndex].y;
}

const landmarkBuffer: Map<number, HandLandmarks[][]> = new Map();
const BUFFER_SIZE = 5;

export function smoothLandmarks(landmarks: HandLandmarks[], trackId: number = 0): HandLandmarks[] {
  if (!landmarkBuffer.has(trackId)) {
    landmarkBuffer.set(trackId, []);
  }

  const buffer = landmarkBuffer.get(trackId)!;
  buffer.push(landmarks);

  if (buffer.length > BUFFER_SIZE) {
    buffer.shift();
  }

  const smoothed: HandLandmarks[] = [];
  for (let i = 0; i < 21; i++) {
    let sumX = 0, sumY = 0, sumZ = 0;

    for (const frame of buffer) {
      sumX += frame[i].x;
      sumY += frame[i].y;
      sumZ += frame[i].z;
    }

    smoothed.push({
      x: sumX / buffer.length,
      y: sumY / buffer.length,
      z: sumZ / buffer.length,
    });
  }

  return smoothed;
}

export function resetSmoothing(trackId: number = 0): void {
  landmarkBuffer.delete(trackId);
}

export class GestureValidator {
  private binaryBuffer: string[] = [];
  private readonly frameThreshold = 1;

  validateGesture(binary: string): string | null {
    if (!binary) return null;

    this.binaryBuffer.push(binary);

    if (this.binaryBuffer.length > this.frameThreshold) {
      this.binaryBuffer.shift();
    }

    if (this.binaryBuffer.length === this.frameThreshold) {
      const majority = this.getMajority();
      if (majority) {
        return majority;
      }
    }

    return null;
  }

  reset(): void {
    this.binaryBuffer = [];
  }

  private getMajority(): string | null {
    const counts = new Map<string, number>();

    for (const binary of this.binaryBuffer) {
      counts.set(binary, (counts.get(binary) || 0) + 1);
    }

    for (const [binary, count] of counts.entries()) {
      if (count >= Math.ceil(this.binaryBuffer.length / 2)) {
        return binary;
      }
    }

    return null;
  }
}