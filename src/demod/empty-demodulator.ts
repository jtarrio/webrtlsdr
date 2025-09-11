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

import { Demod, Mode, getDemod, getMode, modeParameters } from "./modes.js";
import { Player } from "./player.js";
import { AudioPlayer } from "../players/audioplayer.js";
import { SampleReceiver } from "../radio.js";

/**
 * A class that takes a stream of radio samples and demodulates
 * it into an audio signal.
 *
 * The demodulator parameters (scheme, bandwidth, etc) are settable
 * on the fly.
 *
 * Whenever a parameter is changed, the demodulator emits a
 * 'demodulator' event containing the new value. This makes it easy
 * to observe the demodulator's state.
 */
export class Demodulator extends EventTarget implements SampleReceiver {
  /**
   * @param player The player to use. If undefined, an AudioPlayer will be used.
   */
  constructor(player?: Player) {
    super();
    this.inRate = 1024000;
    this.player = player ? player : new AudioPlayer();
    this.squelchControl = new SquelchControl(this.player.sampleRate);
    this.mode = getMode("WBFM");
    this.demod = this.getScheme(this.mode);
    this.frequencyOffset = 0;
    this.latestStereo = false;
  }

  /** The sample rate. */
  private inRate: number;
  /** The audio output device. */
  private player: Player;
  /** Controller that silences the output if the SNR is low. */
  private squelchControl: SquelchControl;
  /** The modulation parameters as a Mode object. */
  private mode: Mode;
  /** The demodulator class. */
  private demod: Demod<any>;
  /** The frequency offset to demodulate from. */
  private frequencyOffset: number;
  /** Whether the latest samples were in stereo. */
  private latestStereo: boolean;
  /** A frequency change we are expecting. */
  private expectingFrequency?: Frequency;

  /** Changes the modulation parameters. */
  setMode(mode: Mode) {
    this.demod = this.getScheme(mode, this.demod);
    this.mode = mode;
  }

  /** Returns the current modulation parameters. */
  getMode(): Mode {
    return this.mode;
  }

  /** Changes the frequency offset. */
  setFrequencyOffset(offset: number) {
    this.frequencyOffset = offset;
  }

  /** Returns the current frequency offset. */
  getFrequencyOffset() {
    return this.frequencyOffset;
  }

  /** Waits until samples arrive with the given center frequency and then sets the offset. */
  expectFrequencyAndSetOffset(center: number, offset: number) {
    this.expectingFrequency = { center, offset };
  }

  /** Sets the audio volume level, from 0 to 1. */
  setVolume(volume: number) {
    this.player.setVolume(volume);
  }

  /** Returns the current audio volume level. */
  getVolume() {
    return this.player.getVolume();
  }

  /** Returns an appropriate instance of Scheme for the requested mode. */
  private getScheme(mode: Mode, demod?: Demod<any>): Demod<any> {
    if (mode.scheme == demod?.getMode().scheme) {
      demod.setMode(mode);
      return demod;
    }

    return getDemod(this.inRate, this.player.sampleRate, mode);
  }

  /** Changes the sample rate. */
  setSampleRate(sampleRate: number): void {
    this.inRate = sampleRate;
    this.demod = this.getScheme(this.mode, undefined);
  }

  /** Receives radio samples. */
  receiveSamples(I: Float32Array, Q: Float32Array, frequency: number): void {
    if (this.expectingFrequency?.center === frequency) {
      this.frequencyOffset = this.expectingFrequency.offset;
      this.expectingFrequency = undefined;
    }

    let { left, right, stereo, snr } = this.demod.demodulate(
      I,
      Q,
      this.frequencyOffset
    );
    this.squelchControl.applySquelch(this.mode, left, right, snr);
    this.player.play(left, right);
    if (stereo != this.latestStereo) {
      this.dispatchEvent(new StereoStatusEvent(stereo));
      this.latestStereo = stereo;
    }
  }

  addEventListener(
    type: "stereo-status",
    callback: (e: StereoStatusEvent) => void | null,
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

export class StereoStatusEvent extends CustomEvent<boolean> {
  constructor(stereo: boolean) {
    super("stereo-status", { detail: stereo, bubbles: true, composed: true });
  }
}

type Frequency = {
  center: number;
  offset: number;
};

class SquelchControl {
  constructor(private sampleRate: number) {}

  private countdown: number = 0;

  applySquelch(
    mode: Mode,
    left: Float32Array,
    right: Float32Array,
    snr: number
  ) {
    const SQUELCH_TAIL = 0.1;
    let params = modeParameters(mode);
    if (!params.hasSquelch()) return;
    if (params.getSquelch() < snr) {
      this.countdown = SQUELCH_TAIL * this.sampleRate;
      return;
    }
    if (this.countdown > 0) {
      this.countdown -= left.length;
      return;
    }
    left.fill(0);
    right.fill(0);
  }
}
