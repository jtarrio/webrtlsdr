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

import { SampleReceiver } from "../radio.js";

/** A SampleReceiver that counts received samples to send a `sample-click` event periodically. */
export class SampleCounter extends EventTarget implements SampleReceiver {
  /**
   * @param sampleRate The initial sample rate.
   * @param clicksPerSecond The number of events per second.
   */
  constructor(private clicksPerSecond?: number) {
    super();
    this.sampleRate = 1024000;
    this.samplesPerClick = this.getSamplesPerClick();
    this.countedSamples = 0;
  }

  private sampleRate: number;
  private samplesPerClick?: number;
  private countedSamples: number;

  private getSamplesPerClick(): number | undefined {
    return this.clicksPerSecond === undefined
      ? undefined
      : Math.floor(this.sampleRate / this.clicksPerSecond);
  }

  setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
    this.samplesPerClick = this.getSamplesPerClick();
  }

  receiveSamples(I: Float32Array, Q: Float32Array): void {
    this.countedSamples += I.length;
    if (
      this.samplesPerClick === undefined ||
      this.samplesPerClick > this.countedSamples
    )
      return;
    this.countedSamples %= this.samplesPerClick;
    this.dispatchEvent(new SampleClickEvent());
  }

  addEventListener(
    type: "sample-click",
    callback: (e: SampleClickEvent) => void | null,
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

export class SampleClickEvent extends Event {
  constructor() {
    super("sample-click");
  }
}
