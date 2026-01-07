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

/** State machine to orchestrate the RTL2832, demodulation, and audio playing. */

import {
  Radio as BaseRadio,
  RadioEvent as BaseRadioEvent,
  RadioEventType as BaseRadioEventType,
  RadioOptions,
  SampleBlock,
} from "@jtarrio/signals/radio.js";
import { DirectSampling } from "../rtlsdr/rtldevice.js";
import { RtlParameter, RtlProvider } from "./source.js";
import { SampleReceiver } from "@jtarrio/signals/radio/sample_receiver.js";

export { type RadioOptions } from "@jtarrio/signals/radio/radio.js";

/** The information in a 'radio' event. */
export type RadioEventType =
  | BaseRadioEventType
  | { type: "directSampling"; active: boolean };

/** The type of 'radio' events. */
export class RadioEvent extends CustomEvent<RadioEventType> {
  constructor(e: RadioEventType) {
    super("radio", { detail: e });
  }
}

/** Provides controls to play, stop, and tune the radio. */
export class Radio extends BaseRadio<RtlParameter> {
  /**
   * Creates an instance of Radio.
   *
   * Since this constructor sends commands, you should call `ready()` before using the radio.
   *
   * @param rtlProvider a RtlSignalSourceProvider instance.
   * @param sampleReceiver the object that will receive the signals from the RTL source.
   * @param options options for the radio.
   */
  constructor(
    rtlProvider: RtlProvider,
    sampleReceiver: SampleReceiver,
    options?: RadioOptions
  ) {
    super(rtlProvider, sampleReceiver, options);
    this.directSampling = false;
    this.setFrequencyCorrection(0);
    this.setGain(null);
    this.setFrequency(88500000);
    this.setDirectSamplingMethod(DirectSampling.Off);
    this.enableBiasTee(false);
  }

  private directSampling: boolean;

  /** Sets the frequency correction factor, in PPM. */
  async setFrequencyCorrection(ppm: number): Promise<void> {
    return this.setParameter("frequency_correction", ppm);
  }

  /** Returns the current frequency correction factor. */
  getFrequencyCorrection(): number {
    return this.getParameter("frequency_correction");
  }

  /**
   * Sets the RF gain.
   * @param gain the gain in dB, or null for automatic gain control.
   */
  async setGain(gain: number | null): Promise<void> {
    return this.setParameter("gain", gain);
  }

  /**
   * Returns the RF gain.
   * @returns the gain in dB, or null for automatic gain control.
   */
  getGain(): number | null {
    return this.getParameter("gain");
  }

  /** Sets the direct sampling method. */
  async setDirectSamplingMethod(method: DirectSampling): Promise<void> {
    return this.setParameter("direct_sampling_method", method);
  }

  /** Returns the current direct sampling method. */
  getDirectSamplingMethod(): DirectSampling {
    return this.getParameter("direct_sampling_method");
  }

  /** Enables or disables the bias tee. */
  async enableBiasTee(enable: boolean): Promise<void> {
    return this.setParameter("bias_tee", enable);
  }

  /** Returns whether the bias tee is enabled. */
  isBiasTeeEnabled(): boolean {
    return this.getParameter("bias_tee");
  }

  onReceiveSamples(block: SampleBlock): void {
    let directSampling = block.data?.directSampling || false;
    if (directSampling == this.directSampling) return;
    this.directSampling = directSampling;
    this.dispatchEvent(
      new RadioEvent({
        type: "directSampling",
        active: this.directSampling,
      })
    );
  }

  addEventListener(
    type: "radio",
    callback: (e: RadioEvent) => void | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  addEventListener(
    type: "radio",
    callback: (e: BaseRadioEvent) => void | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  addEventListener(
    type: string,
    callback: any,
    options?: boolean | AddEventListenerOptions | undefined
  ): void {
    super.addEventListener(
      type,
      callback as EventListenerOrEventListenerObject | null,
      options
    );
  }
}
