// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/** Interface for classes that get audio samples from a Demodulator class. */
export interface Player {
  /** The sample rate this class expects. The demodulator will call 'play' with samples at this rate. */
  readonly sampleRate: number;

  /**
   * Outputs the given audio samples.
   * @param left The samples for the left speaker.
   * @param right The samples for the right speaker.
   */
  play(left: Float32Array, right: Float32Array): void;

  /**
   * Sets the output volume.
   * @param volume The volume to set, a number from 0 (silent) to 1 (full volume).
   */
  setVolume(volume: number): void;

  /** Returns the currently set volume. */
  getVolume(): number;
}
