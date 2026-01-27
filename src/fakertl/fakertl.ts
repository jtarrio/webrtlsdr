// Copyright 2026 Jacobo Tarrio Barreiro. All rights reserved.
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

import {
  GeneratedSource,
  SampleGenerator,
} from "@jtarrio/signals/sources/generated.js";
import { U8Pool } from "@jtarrio/signals/dsp/buffers.js";
import {
  DirectSampling,
  RtlDevice,
  RtlDeviceProvider,
  SampleBlock,
} from "../rtlsdr.js";

/** A provider for fake RTL-SDR devices. */
export class FakeRtlDeviceProvider implements RtlDeviceProvider {
  /**
   * @param generator A SampleGenerator that returns the signals for the fake RTL-SDR device.
   */
  constructor(private generator: SampleGenerator) {}

  async get(): Promise<RtlDevice> {
    return new FakeRtlDevice(this.generator);
  }
}

/** A class that can be used to test without using a real RTL-SDR device. */
export class FakeRtlDevice implements RtlDevice {
  constructor(generator: SampleGenerator) {
    this.gain = null;
    this.gainMultiplier = 1;
    this.ppm = 0;
    this.directSamplingMethod = DirectSampling.Off;
    this.biasTee = false;
    this.source = new GeneratedSource(this.adaptSource(generator));
    this.source.setSampleRate(1024000);
    this.pool = new U8Pool(8);
  }

  private source: GeneratedSource;
  private pool: U8Pool;
  private gain: number | null;
  private gainMultiplier: number;
  private ppm: number;
  private directSamplingMethod: DirectSampling;
  private biasTee: boolean;

  setSampleRate(rate: number): Promise<number> {
    return this.source.setSampleRate(Math.floor(rate));
  }

  async setCenterFrequency(freq: number): Promise<number> {
    return this.source.setCenterFrequency(freq);
  }

  async setGain(gain: number | null): Promise<void> {
    this.gain = gain;
    if (gain != null) {
      this.gainMultiplier = Math.pow(10, (gain - 25) / 20);
    }
  }

  getGain(): number | null {
    return this.gain;
  }

  async setFrequencyCorrection(ppm: number): Promise<void> {
    this.ppm = Math.floor(ppm);
  }

  getFrequencyCorrection(): number {
    return this.ppm;
  }

  async setDirectSamplingMethod(method: DirectSampling): Promise<void> {
    this.directSamplingMethod = method;
  }

  getDirectSamplingMethod(): DirectSampling {
    return this.directSamplingMethod;
  }

  async enableBiasTee(enable: boolean): Promise<void> {
    this.biasTee = enable;
  }

  isBiasTeeEnabled(): boolean {
    return this.biasTee;
  }

  resetBuffer(): Promise<void> {
    return this.source.startReceiving();
  }

  async readSamples(length: number): Promise<SampleBlock> {
    let output = await this.source.readSamples(length);
    let data = this.pool.get(output.I.length * 2);
    for (let i = 0; i < output.I.length; ++i) {
      data[2 * i] = output.I[i];
      data[2 * i + 1] = output.Q[i];
    }
    return {
      frequency: output.frequency,
      data: data.buffer as ArrayBuffer,
      directSampling: false,
    };
  }

  close(): Promise<void> {
    return this.source.close();
  }

  private adaptSource(generator: SampleGenerator): SampleGenerator {
    return (
      firstSample: number,
      sampleRate: number,
      centerFrequency: number,
      I: Float32Array,
      Q: Float32Array,
    ) => {
      centerFrequency = centerFrequency * (1 + this.ppm / 1e6);
      generator(firstSample, sampleRate, centerFrequency, I, Q);
      if (this.gain !== null) {
        let mul = this.gainMultiplier;
        for (let i = 0; i < I.length; ++i) {
          I[i] = Math.max(-1, Math.min(I[i] * mul, 1));
          Q[i] = Math.max(-1, Math.min(Q[i] * mul, 1));
        }
      }
      for (let i = 0; i < I.length; ++i) {
        I[i] = Math.round(((I[i] + 1) * 255) / 2);
        Q[i] = Math.round(((Q[i] + 1) * 255) / 2);
      }
    };
  }
}
