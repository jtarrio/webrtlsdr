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

import { makeLowPassKernel } from "../dsp/coefficients.js";
import { AGC, FIRFilter, FrequencyShifter } from "../dsp/filters.js";
import { getPower } from "../dsp/power.js";
import { ComplexDownsampler } from "../dsp/resamplers.js";
import { Configurator, Demod, Demodulated } from "./modes.js";

/** Mode parameters for CW. */
export type ModeCW = { scheme: "CW"; bandwidth: number };

/** Output frequency of the zero-beat CW signals. */
const ToneFrequency = 600;

/** A demodulator for continuous wave signals. */
export class DemodCW implements Demod<ModeCW> {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param mode The mode to use initially.
   */
  constructor(inRate: number, private outRate: number, private mode: ModeCW) {
    this.shifter = new FrequencyShifter(inRate);
    this.downsampler = new ComplexDownsampler(inRate, outRate, 151);
    const kernel = makeLowPassKernel(outRate, mode.bandwidth / 2, 351);
    this.filterI = new FIRFilter(kernel);
    this.filterQ = new FIRFilter(kernel);
    this.toneShifter = new FrequencyShifter(outRate);
    this.agc = new AGC(outRate, 10);
  }

  private shifter: FrequencyShifter;
  private downsampler: ComplexDownsampler;
  private filterI: FIRFilter;
  private filterQ: FIRFilter;
  private toneShifter: FrequencyShifter;
  private agc: AGC;

  getMode(): ModeCW {
    return this.mode;
  }

  setMode(mode: ModeCW) {
    this.mode = mode;
    const kernel = makeLowPassKernel(this.outRate, mode.bandwidth / 2, 151);
    this.filterI.setCoefficients(kernel);
    this.filterQ.setCoefficients(kernel);
  }

  /** Demodulates the given I/Q samples into the real output. */
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
    let signalPower = (getPower(I, Q) * this.outRate) / this.mode.bandwidth;
    this.toneShifter.inPlace(I, Q, ToneFrequency);
    this.agc.inPlace(I);
    return {
      left: I,
      right: new Float32Array(I),
      stereo: false,
      snr: signalPower / allPower,
    };
  }
}

/** Configurator for the CW mode. */
export class ConfigCW extends Configurator<ModeCW> {
  constructor(mode: ModeCW | string) {
    super(mode);
  }
  protected create(): ModeCW {
    return { scheme: "CW", bandwidth: 50 };
  }
  hasBandwidth(): boolean {
    return true;
  }
  getBandwidth(): number {
    return this.mode.bandwidth;
  }
  setBandwidth(bandwidth: number): ConfigCW {
    this.mode = {
      ...this.mode,
      bandwidth: Math.max(5, Math.min(bandwidth, 1000)),
    };
    return this;
  }
}
