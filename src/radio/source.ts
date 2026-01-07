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

/** Signal sources that read from an RTL-SDR device. */

import { SampleBlock } from "@jtarrio/signals/radio/sample_block.js";
import {
  SignalSource,
  SignalSourceProvider,
} from "@jtarrio/signals/radio/signal_source.js";
import { U8ToFloat32 } from "@jtarrio/signals/dsp/converters.js";
import {
  DirectSampling,
  RtlDevice,
  RtlDeviceProvider,
} from "../rtlsdr/rtldevice.js";
import { RTL2832U_Provider } from "../rtlsdr.js";

/** Names of parameters for the RTL signal source. */
export type RtlParameter =
  | "frequency_correction"
  | "gain"
  | "direct_sampling_method"
  | "bias_tee";

/** SignalSource that reads from an RTL-SDR device. */
export class RtlSource implements SignalSource<RtlParameter> {
  constructor(private rtl: RtlDevice) {
    this.converter = new U8ToFloat32();
  }

  private converter: U8ToFloat32;

  setSampleRate(sampleRate: number): Promise<number> {
    return this.rtl.setSampleRate(sampleRate);
  }

  setCenterFrequency(freq: number): Promise<number> {
    return this.rtl.setCenterFrequency(freq);
  }

  setParameter<V>(parameter: RtlParameter, value: V): Promise<void | V> {
    switch (parameter) {
      case "bias_tee":
        return this.rtl.enableBiasTee(value as boolean);
      case "direct_sampling_method":
        return this.rtl.setDirectSamplingMethod(value as DirectSampling);
      case "frequency_correction":
        return this.rtl.setFrequencyCorrection(value as number);
      case "gain":
        return this.rtl.setGain(value as number | null);
    }
  }

  startReceiving(): Promise<void> {
    return this.rtl.resetBuffer();
  }

  async readSamples(length: number): Promise<SampleBlock> {
    let block = await this.rtl.readSamples(length);
    let iq = this.converter.convert(block.data);
    return {
      I: iq[0],
      Q: iq[1],
      frequency: block.frequency,
      data: { directSampling: block.directSampling },
    };
  }

  close(): Promise<void> {
    return this.rtl.close();
  }
}

/** SignalSourceProvider that creates a source from the device returned by an RtlDeviceProvider. */
export class RtlProvider implements SignalSourceProvider {
  constructor(provider?: RtlDeviceProvider) {
    this.provider = provider || new RTL2832U_Provider();
  }

  provider: RtlDeviceProvider;

  async get(): Promise<SignalSource> {
    return new RtlSource(await this.provider.get());
  }
}
