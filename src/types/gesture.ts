export interface Gesture {
  id: string;
  binary_code: string;
  phrase: string;
  created_at: string;
  updated_at: string;
}

export interface FingerState {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}
