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

/**
 * Demodulation schemes consist of three parts: a class that does the demodulation
 * (extends `Demod`), a type for the modulation parameters (extends `Mode`),
 * and a class that provides a uniform interface to configure the modulation
 * (extends `Configurator`).
 *
 * The type for the modulation parameters is an object that must contain a
 * field named `scheme`, which contains the name of the modulation scheme.
 * Other than that, your type may contain anything; however, I recommend that
 * you make it JSON serializable.
 *
 * The configurator class lets you use generic code to configure the mode.
 * It provides methods to tell whether some settings are configurable, and to
 * get and set their values. Those methods take care of clamping the minimum
 * and maximum values and other validation.
 *
 * The demodulator class takes I and Q samples and outputs audio samples.
 * It can be configured using the `setMode()` method, which takes an object
 * with the new modulation parameters.
 *
 * Demodulation schemes can be registered using the `registerDemod()` function,
 * which makes them available via the `getSchemes()`, `getMode()`, and `getDemod()`
 * functions. This also lets the `Demodulator` class use your demodulation scheme.
 */

/** Interface for classes that demodulate IQ radio streams. */
export interface Demod<M extends Mode> {
  /** Returns the current mode parameters. */
  getMode(): M;
  /** Changes the mode parameters for the demod. */
  setMode(mode: M): void;
  /**
   * Demodulates the signal.
   * @param samplesI The I components of the samples.
   * @param samplesQ The Q components of the samples.
   * @param freqOffset The offset of the signal in the samples.
   * @returns The demodulated audio signal.
   */
  demodulate(I: Float32Array, Q: Float32Array, freqOffset: number): Demodulated;
}

/** Demodulator output. */
export type Demodulated = {
  /** Left speaker. */
  left: Float32Array;
  /** Right speaker. */
  right: Float32Array;
  /** The signal is in stereo. */
  stereo: boolean;
  /** Estimated signal to noise ratio (in units, not dB). */
  snr: number;
};

/** Modulation parameters. */
export type Mode = { scheme: string };

/**
 * Registers a modulation scheme. If a modulation scheme by that name already exists, it is replaced.
 * @param name the name of the modulation scheme. Must match the content of `scheme` in the mode.
 * @param demod the constructor of the Demod class.
 * @param config the constructor of the Configurator class.
 */
export function registerDemod<M extends Mode>(
  name: M["scheme"],
  demod: DemodConstructor<M>,
  config: ConfigConstructor<M>
) {
  registeredDemods.set(name, { demod: demod, config: config });
}

/** Unregisters a modulation scheme. */
export function unregisterDemod(name: string) {
  registeredDemods.delete(name);
}

/** Returns the list of registered modulation schemes, in the order in which they were registered. */
export function getSchemes(): Array<string> {
  return [...registeredDemods.keys()];
}

/** Returns the default mode for the given scheme name. */
export function getMode(scheme: string): Mode {
  let reg = getRegisteredDemod(scheme);
  return new reg.config(scheme).mode;
}

/** Returns a Scheme object for the given mode. */
export function getDemod<M extends Mode>(
  inRate: number,
  outRate: number,
  mode: M
): Demod<M> {
  let reg = getRegisteredDemod(mode);
  return new reg.demod(inRate, outRate, mode);
}

/** Returns accessors for the mode's or scheme's parameters. */
export function modeParameters<M extends Mode>(mode: M): Configurator<M>;
export function modeParameters(scheme: string): Configurator<Mode>;
export function modeParameters(mode: Mode | string): Configurator<Mode> {
  let reg = getRegisteredDemod(mode);
  return new reg.config(mode);
}

/** A base for classes that inspect and modify a mode parameters object. */
export abstract class Configurator<M extends Mode> {
  constructor(private base: M | string) {}
  get mode(): M {
    if (typeof this.base === "string") {
      this.base = this.create(this.base);
    }
    return this.base;
  }
  protected set mode(mode: M) {
    this.base = mode;
  }

  /** Creates an instance of the mode object for the given scheme with the default parameters. */
  protected abstract create(scheme: string): M;

  /** Returns whether stereo output is settable in this mode. */
  hasStereo(): boolean {
    return false;
  }
  /** Returns whether stereo output is enabled. */
  getStereo(): boolean {
    return false;
  }
  /** Enables or disables stereo output. */
  setStereo(stereo: boolean): Configurator<M> {
    return this;
  }
  /** Returns whether the bandwidth is settable in this mode. */
  hasBandwidth(): boolean {
    return false;
  }
  /**
   * Returns the bandwidth used by this mode.
   * You should always override this as every mode uses some bandwidth, even if it's not settable.
   */
  abstract getBandwidth(): number;
  /** Changes the bandwidth used by this mode. */
  setBandwidth(bandwidth: number): Configurator<M> {
    return this;
  }
  /** Returns whether the squelch level is settable. */
  hasSquelch(): boolean {
    return false;
  }
  /** Returns the current squelch level. */
  getSquelch(): number {
    return 0;
  }
  /** Sets the squelch level. */
  setSquelch(squelch: number): Configurator<M> {
    return this;
  }
}

/** The type for a constructor of a Scheme object. */
export type DemodConstructor<M extends Mode> = new (
  inRate: number,
  outRate: number,
  mode: M
) => Demod<M>;

/** The type for a constructor of a Configurator object. */
export type ConfigConstructor<M extends Mode> = new (
  base: M | string
) => Configurator<M>;

type RegisteredDemod = {
  demod: DemodConstructor<any>;
  config: ConfigConstructor<any>;
};
var registeredDemods = new Map<string, RegisteredDemod>();

function getRegisteredDemod(mode: Mode | string): RegisteredDemod {
  let scheme = typeof mode === "string" ? mode : mode.scheme;
  let reg = registeredDemods.get(scheme);
  if (!reg) throw `Scheme "${scheme}" was not registered.`;
  return reg;
}
