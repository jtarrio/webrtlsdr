// Copyright 2026 Jacobo Tarrio Barreiro. All rights reserved.
// Copyright 2014 Google Inc. All rights reserved.
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

import { makeLowPassKernel } from "../dsp/coefficients.js";
import { FMDemodulator } from "../dsp/demodulators.js";
import { FIRFilter, FrequencyShifter } from "../dsp/filters.js";
import { getPower } from "../dsp/power.js";
import { ComplexDownsampler } from "../dsp/resamplers.js";
import { Configurator, Demod, Demodulated } from "./modes.js";

/** Mode parameters for NBFM. */
export type ModeNBFM = { scheme: "NBFM"; maxF: number; squelch: number };

/** Mode options for NBFM. */
export type OptionsNBFM = {
  /** Number of taps for the downsampler filter. Must be an odd number. 151 by default. */
  downsamplerTaps?: number;
  /** Number of taps for the RF filter. Must be an odd number. 151 by default. */
  rfTaps?: number;
};

/** A demodulator for narrowband FM signals. */
export class DemodNBFM implements Demod<ModeNBFM> {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param mode The mode to use initially.
   * @param options Options for the demodulator.
   */
  constructor(
    inRate: number,
    private outRate: number,
    private mode: ModeNBFM,
    options?: OptionsNBFM
  ) {
    const downsamplerTaps = options?.downsamplerTaps || 151;
    this.rfTaps = options?.rfTaps || 151;
    this.shifter = new FrequencyShifter(inRate);
    this.downsampler = new ComplexDownsampler(inRate, outRate, downsamplerTaps);
    const kernel = makeLowPassKernel(outRate, mode.maxF, this.rfTaps);
    this.filterI = new FIRFilter(kernel);
    this.filterQ = new FIRFilter(kernel);
    this.demodulator = new FMDemodulator(mode.maxF / outRate);
  }

  private rfTaps: number;
  private shifter: FrequencyShifter;
  private downsampler: ComplexDownsampler;
  private filterI: FIRFilter;
  private filterQ: FIRFilter;
  private demodulator: FMDemodulator;

  getMode(): ModeNBFM {
    return this.mode;
  }

  setMode(mode: ModeNBFM) {
    this.mode = mode;
    const kernel = makeLowPassKernel(this.outRate, mode.maxF, this.rfTaps);
    this.filterI.setCoefficients(kernel);
    this.filterQ.setCoefficients(kernel);
    this.demodulator.setMaxDeviation(mode.maxF / this.outRate);
  }

  /**
   * Demodulates the signal.
   * @param samplesI The I components of the samples.
   * @param samplesQ The Q components of the samples.
   * @param freqOffset The offset of the signal in the samples.
   * @returns The demodulated audio signal.
   */
  demodulate(
    samplesI: Float32Array,
    samplesQ: Float32Array,
    freqOffset: number
  ): Demodulated {
    this.shifter.inPlace(samplesI, samplesQ, -freqOffset);
    const [I, Q] = this.downsampler.downsample(samplesI, samplesQ);
    let allPower = getPower(I, Q);
    this.filterI.inPlace(I);
    this.filterQ.inPlace(Q);
    let signalPower = (getPower(I, Q) * this.outRate) / (this.mode.maxF * 2);
    this.demodulator.demodulate(I, Q, I);
    return {
      left: I,
      right: new Float32Array(I),
      stereo: false,
      snr: signalPower / allPower,
    };
  }
}

/** Configurator for the NBFM mode. */
export class ConfigNBFM extends Configurator<ModeNBFM> {
  constructor(mode: ModeNBFM | string) {
    super(mode);
  }
  protected create(): ModeNBFM {
    return { scheme: "NBFM", maxF: 5000, squelch: 0 };
  }
  hasBandwidth(): boolean {
    return true;
  }
  getBandwidth(): number {
    return 2 * this.mode.maxF;
  }
  setBandwidth(bandwidth: number): ConfigNBFM {
    this.mode = {
      ...this.mode,
      maxF: Math.max(125, Math.min(bandwidth / 2, 15000)),
    };
    return this;
  }
  hasSquelch(): boolean {
    return true;
  }
  getSquelch(): number {
    return this.mode.squelch;
  }
  setSquelch(squelch: number): ConfigNBFM {
    this.mode = { ...this.mode, squelch: Math.max(0, Math.min(squelch, 6)) };
    return this;
  }
}
