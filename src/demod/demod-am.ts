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
import { AMDemodulator } from "../dsp/demodulators.js";
import { FrequencyShifter, FIRFilter } from "../dsp/filters.js";
import { getPower } from "../dsp/power.js";
import { ComplexDownsampler } from "../dsp/resamplers.js";
import { Configurator, Demod, Demodulated } from "./modes.js";

/** Mode parameters for AM. */
export type ModeAM = { scheme: "AM"; bandwidth: number; squelch: number };

/** Mode options for AM. */
export type OptionsAM = {
  /** Number of taps for the downsampler filter. Must be an odd number. 151 by default. */
  downsamplerTaps?: number;
  /** Number of taps for the RF filter. Must be an odd number. 151 by default. */
  rfTaps?: number;
};

/** A demodulator for amplitude modulated signals. */
export class DemodAM implements Demod<ModeAM> {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param mode The mode to use initially.
   * @param options Options for the demodulator.
   */
  constructor(
    inRate: number,
    private outRate: number,
    private mode: ModeAM,
    options?: OptionsAM
  ) {
    const downsamplerTaps = options?.downsamplerTaps || 151;
    this.rfTaps = options?.rfTaps || 151;
    this.shifter = new FrequencyShifter(inRate);
    this.downsampler = new ComplexDownsampler(inRate, outRate, downsamplerTaps);
    const kernel = makeLowPassKernel(
      outRate,
      this.mode.bandwidth / 2,
      this.rfTaps
    );
    this.filterI = new FIRFilter(kernel);
    this.filterQ = new FIRFilter(kernel);
    this.demodulator = new AMDemodulator(outRate);
  }

  private rfTaps: number;
  private shifter: FrequencyShifter;
  private downsampler: ComplexDownsampler;
  private filterI: FIRFilter;
  private filterQ: FIRFilter;
  private demodulator: AMDemodulator;

  getMode(): ModeAM {
    return this.mode;
  }

  setMode(mode: ModeAM) {
    this.mode = mode;
    const kernel = makeLowPassKernel(
      this.outRate,
      mode.bandwidth / 2,
      this.rfTaps
    );
    this.filterI.setCoefficients(kernel);
    this.filterQ.setCoefficients(kernel);
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
    let signalPower = (getPower(I, Q) * this.outRate) / this.mode.bandwidth;
    this.demodulator.demodulate(I, Q, I);
    return {
      left: I,
      right: new Float32Array(I),
      stereo: false,
      snr: signalPower / allPower,
    };
  }
}

/** Configurator for the AM mode. */
export class ConfigAM extends Configurator<ModeAM> {
  constructor(mode: ModeAM | string) {
    super(mode);
  }
  protected create(): ModeAM {
    return { scheme: "AM", bandwidth: 15000, squelch: 0 };
  }
  hasBandwidth(): boolean {
    return true;
  }
  getBandwidth(): number {
    return this.mode.bandwidth;
  }
  setBandwidth(bandwidth: number): ConfigAM {
    this.mode = {
      ...this.mode,
      bandwidth: Math.max(250, Math.min(bandwidth, 30000)),
    };
    return this;
  }
  hasSquelch(): boolean {
    return true;
  }
  getSquelch(): number {
    return this.mode.squelch;
  }
  setSquelch(squelch: number): ConfigAM {
    this.mode = { ...this.mode, squelch: Math.max(0, Math.min(squelch, 6)) };
    return this;
  }
}
