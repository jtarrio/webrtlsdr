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

/** A block of samples returned by RtlDevice.readSamples() */
export type SampleBlock = {
  /** The frequency the radio was tuned at when these samples were captured. */
  frequency: number;
  /** The samples as an sequence of (U8, U8) pairs, where the first U8 is the I value and the second is the Q value. */
  data: ArrayBuffer;
  /** Whether the radio was in direct sampling mode. */
  directSampling: boolean;
};

/** Interface for an RTL-type device. */
export interface RtlDevice {
  /** Sets the device's sample rate. */
  setSampleRate(rate: number): Promise<number>;
  /** Sets the frequency correction factor, in parts-per-million. */
  setFrequencyCorrection(ppm: number): Promise<void>;
  /** Returns the currently set frequency correction factor. */
  getFrequencyCorrection(): number;
  /** Sets the tuner's gain, or null for automatic gain control. */
  setGain(gain: number | null): Promise<void>;
  /** Returns the currently set tuner's gain. */
  getGain(): number | null;
  /** Sets the center frequency the device will be listening on. */
  setCenterFrequency(freq: number): Promise<number>;
  /** Sets the direct sampling method. */
  setDirectSamplingMethod(method: DirectSampling): Promise<void>;
  /** Returns the currently set direct sampling method. */
  getDirectSamplingMethod(): DirectSampling;
  /** Enables or disables the bias T, if equipped. */
  enableBiasTee(enable: boolean): Promise<void>;
  /** Returns whether the bias T is enabled. */
  isBiasTeeEnabled(): boolean;
  /** Resets the sample buffers. You must do this before you start reading samples. */
  resetBuffer(): Promise<void>;
  /** Reads the given number of samples. */
  readSamples(length: number): Promise<SampleBlock>;
  /** Shuts down the device. */
  close(): Promise<void>;
}

/** Direct sampling modes. */
export enum DirectSampling {
  /** No direct sampling. */
  Off,
  /** I channel. */
  I,
  /** Q channel. */
  Q,
}

/** Interface for classes that return RtlDevice instances. */
export interface RtlDeviceProvider {
  /** Returns an open device. */
  get(): Promise<RtlDevice>;
}
