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

import { makeLowPassKernel } from "../dsp/coefficients";
import { Sideband, SSBDemodulator } from "../dsp/demodulators";
import { FrequencyShifter, AGC, FIRFilter } from "../dsp/filters";
import { getPower } from "../dsp/power";
import { ComplexDownsampler } from "../dsp/resamplers";
import { Configurator, Demod, Demodulated } from "./modes";

/** Mode parameters for SSB. */
export type ModeSSB = {
  scheme: "USB" | "LSB";
  bandwidth: number;
  squelch: number;
};

/** A demodulator for single-sideband modulated signals. */
export class DemodSSB implements Demod<ModeSSB> {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param mode The mode to use initially.
   */
  constructor(inRate: number, private outRate: number, private mode: ModeSSB) {
    this.shifter = new FrequencyShifter(inRate);
    this.downsampler = new ComplexDownsampler(inRate, outRate, 151);
    const kernel = makeLowPassKernel(this.outRate, mode.bandwidth / 2, 151);
    this.filter = new FIRFilter(kernel);
    this.demodulator = new SSBDemodulator(
      mode.scheme == "USB" ? Sideband.Upper : Sideband.Lower
    );
    this.agc = new AGC(outRate, 3);
  }

  private shifter: FrequencyShifter;
  private downsampler: ComplexDownsampler;
  private filter: FIRFilter;
  private demodulator: SSBDemodulator;
  private agc: AGC;

  getMode(): ModeSSB {
    return this.mode;
  }

  setMode(mode: ModeSSB) {
    this.mode = mode;
    const kernel = makeLowPassKernel(this.outRate, mode.bandwidth / 2, 151);
    this.filter.setCoefficients(kernel);
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
    this.demodulator.demodulate(I, Q, I);
    this.filter.inPlace(I);
    let signalPower =
      (getPower(I, I) * this.outRate) / (this.mode.bandwidth * 2);
    this.agc.inPlace(I);
    return {
      left: I,
      right: new Float32Array(I),
      stereo: false,
      snr: signalPower / allPower,
    };
  }
}

/** Configurator for the USB and LSB modes. */
export class ConfigSSB extends Configurator<ModeSSB> {
  constructor(mode: ModeSSB | string) {
    super(mode);
  }
  protected create(scheme: string): ModeSSB {
    return { scheme: scheme as "USB" | "LSB", bandwidth: 2800, squelch: 0 };
  }
  hasBandwidth(): boolean {
    return true;
  }
  getBandwidth(): number {
    return this.mode.bandwidth;
  }
  setBandwidth(bandwidth: number): ConfigSSB {
    this.mode = {
      ...this.mode,
      bandwidth: Math.max(10, Math.min(bandwidth, 15000)),
    };
    return this;
  }
  hasSquelch(): boolean {
    return true;
  }
  getSquelch(): number {
    return this.mode.squelch;
  }
  setSquelch(squelch: number): ConfigSSB {
    this.mode = { ...this.mode, squelch: Math.max(0, Math.min(squelch, 6)) };
    return this;
  }
}
