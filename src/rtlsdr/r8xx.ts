// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
// Copyright 2013 Google Inc. All rights reserved.
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

import { RadioError, RadioErrorType } from "../errors.js";
import { RtlCom } from "./rtlcom.js";
import { Tuner } from "./tuner.js";

/** Standard configurations for the multiplexer in different frequency bands. */
export const STD_MUX_CFGS: [number, number, number, number][] = [
  [0, 0b1000, 0b00000010, 0b11011111],
  [50, 0b1000, 0b00000010, 0b10111110],
  [55, 0b1000, 0b00000010, 0b10001011],
  [60, 0b1000, 0b00000010, 0b01111011],
  [65, 0b1000, 0b00000010, 0b01101001],
  [70, 0b1000, 0b00000010, 0b01011000],
  [75, 0b0000, 0b00000010, 0b01000100],
  [90, 0b0000, 0b00000010, 0b00110100],
  [110, 0b0000, 0b00000010, 0b00100100],
  [140, 0b0000, 0b00000010, 0b00010100],
  [180, 0b0000, 0b00000010, 0b00010011],
  [250, 0b0000, 0b00000010, 0b00010001],
  [280, 0b0000, 0b00000010, 0b00000000],
  [310, 0b0000, 0b01000001, 0b00000000],
  [588, 0b0000, 0b01000000, 0b00000000],
  //      ^       ^^    ^^    ^^^^^^^^
  //      |       ||    ||    ||||++++- LPF (0000: highest)
  //      |       ||    ||    ++++- LPNF (0000: highest)
  //      |       ||    ++- RF filter (00: high, 01: med, 10: low)
  //      |       ++- tracking filter (01: bypass)
  //      +- open drain (1: low Z)
];

/** Operations on R820/R828/R860 style tuner chips. */
export class R8xx implements Tuner {
  /** Frequency of the oscillator crystal. */
  static XTAL_FREQ = 28800000;

  /** Initial values for registers 0x05-0x1f. */
  static REGISTERS = [
    // Reg 0x05: [7] Loop-through off (1=off, 0=on), [6] Cable 1 LNA off, [5] LNA 1 power on (0=on, 1=off), [4] LNA gain auto (0=auto, 1=manual), [3:0] LNA manual gain 3
    0b10000011,
    // Reg 0x06: [7] Power detector 1 on (0=on, 1=off), [6] Power detector 3 narrowband on (0=on, 1=off), [5] Filter gain +3dB, [4] Mixer 6MHz filter on, [3] Cable 2 LNA off, [2:0] LNA bias power 2
    0b00110010,
    // Reg 0x07: [7] Mixer sideband lower (0=lower, 1=upper), [6] Mixer power on (1=on, 0=off), [5] Mixer current normal, [4] Mixer gain auto (1=auto, 0=manual), [3:0] Mixer manual gain 5
    0b01110101,
    // Reg 0x08: [7] Mixer buffer power on (1=on, 0=off), [6] Mixer buffer low current, [5:0] Image gain adjustment (IMR_G) 0
    0b11000000,
    // Reg 0x09: [7] IF filter power on (0=on, 1=off), [6] IF filter low current, [5:0] Image phase adjustment (IMR_P) 0
    0b01000000,
    // Reg 0x0a: [7] Channel filter power on (1=on, 0=off), [6:5] Filter power level 2, [4] Channel filter high Q, [3:0] Filter bandwidth fine tune 6
    0b11010110,
    // Reg 0x0b: [7:5] Filter bandwidth coarse tune 3, [4] Filter calibration trigger (0=idle), [3:0] High-pass filter corner 12
    0b01101100,
    // Reg 0x0c: [7] Fixed 1, [6] IF VGA power on (1=on, 0=off), [5] Fixed 1, [4] VGA gain mode (1=pin/auto, 0=manual), [3:0] VGA manual gain 5.5dB
    0b11110101,
    // Reg 0x0d: [7:4] LNA AGC power detector high threshold 0.94V, [3:0] Low threshold 0.64V
    0b01100011,
    // Reg 0x0e: [7:4] Mixer AGC power detector high threshold 1.04V, [3:0] Low threshold 0.84V
    0b01110101,
    // Reg 0x0f: [7] Filter extension widest off, [6:5] LDO voltage 3.0V, [4] Clock output off (0=on, 1=off), [3] Fixed 1, [2] Filter calibration clock off, [1] Internal AGC clock on, [0] Fixed 0
    0b01101000,
    // Reg 0x10: [7:5] PLL-to-mixer divider 3 (1/16), [4] PLL reference divider 1:1 (0=1:1, 1=1:2), [3] Crystal swing low (1=low, 0=high), [2] Fixed 1, [1:0] Internal crystal cap 0 pF
    0b01101100,
    // Reg 0x11: [7:6] PLL analog regulator 2.0V (10=2.0V, 00=off), [5:4] Charge pump bias 0, [3] Calibration bias 0, [2:0] Reference bias 3
    0b10000011,
    // Reg 0x12: [7:5] VCO core current level 4 (mid), [4] Fixed 0, [3] Sigma-delta modulator (SDM) dither/power (0=fractional-N on, 1=integer-N), [2:0] Fixed 0
    0b10000000,
    // Reg 0x13: [7:6] VCO control 0, [5:0] VCO frequency band 0
    0b00000000,
    // Reg 0x14: [7:6] Phase-splitter remainder SI = 0, [5:0] Integer divider word NI = 15
    0b00001111,
    // Reg 0x15: [7:0] SDM fractional division value low byte SDM_IN[8:1] = 0x00
    0b00000000,
    // Reg 0x16: [7:0] SDM fractional division value high byte SDM_IN[16:9] = 0xc0
    0b11000000,
    // Reg 0x17: [7:6] PLL digital regulator 1.8V 8mA (00=on, 11=off), [5:4] Prescaler 4/5 current 150uA, [3] Open-drain pin (0=high-Z, 1=low-Z), [2:0] Bias 0
    0b00110000,
    // Reg 0x18: [7:6] Ring VCO bias (01), [5] Ring power, [4] Image rejection bias, [3:0] Reserved (1000)
    0b01001000,
    // Reg 0x19: [7] RF filter power on (1=on, 0=off), [6:5] RF polyphase filter current normal (10), [4] AGC pin select (0=agc_in, 1=agc_in2), [3:0] Ring divider (1100)
    0b11001100,
    // Reg 0x1a: [7:6] Tracking filter bypass (01=bypass, 00=on), [5:4] AGC clock period 80ms (10), [3:2] PLL auto-tune clock 128kHz (00), [1:0] RF filter highest band (00)
    0b01100000,
    // Reg 0x1b: [7:4] Low-pass notch filter (LPNF) highest corner (0000), [3:0] Tracking filter low-pass (LPF) highest corner (0000)
    0b00000000,
    // Reg 0x1c: [7:4] Power detector 3 take-over point (TOP) 5, [3] Mixer discharge normal, [2] LNA power detector low discharge mode, [1:0] Reserved (00)
    0b01010100,
    // Reg 0x1d: [7:6] LNA narrow-band power detector bandwidth (10), [5:3] Power detector 1 TOP 5, [2:0] Power detector 2 TOP 6
    0b10101110,
    // Reg 0x1e: [7] Reserved 0, [6] Filter extension enable, [5] Channel filter extension at max LNA gain off, [4:0] LNA discharge current / PDET timing 10
    0b01001010,
    // Reg 0x1f: [7] Loop-through attenuation bypass (1=bypass, 0=enable), [6] Fixed 1, [5:0] Reserved 0
    0b11000000,
  ];

  /** A bit mask to reverse the bits in a byte. */
  static BIT_REVS = [
    0x0, 0x8, 0x4, 0xc, 0x2, 0xa, 0x6, 0xe, 0x1, 0x9, 0x5, 0xd, 0x3, 0xb, 0x7,
    0xf,
  ];

  /** This tuner's intermediate frequency. */
  static IF_FREQ = 3570000;

  /** The frequency of the oscillator crystal. */
  private xtalFreq: number;

  /** Whether the PLL in the tuner is locked. */
  private hasPllLock: boolean;

  /** Shadow registers 0x05-0x1f, for setting values using masks. */
  private shadowRegs: Uint8Array;

  /**
   * Checks if a R8xx tuner is present.
   */
  static async check(com: RtlCom, i2c: number): Promise<boolean> {
    await com.openI2C();
    let found = false;
    try {
      // Read Byte 0: Tuner chip ID (0x69 for Rafael Micro R82xx tuners)
      let data = await com.getI2CReg(i2c, 0);
      found = data == 0x69;
    } catch {}
    await com.closeI2C();
    return found;
  }

  /**
   * @param com The RTL communications object.
   * @param i2c The tuner's I2C address.
   * @param muxCfgs The tuner's multiplexer configurations.
   */
  constructor(
    protected com: RtlCom,
    private i2c: number,
    private muxCfgs: [number, number, number, number][],
    private vcoPowerRef: number
  ) {
    this.xtalFreq = R8xx.XTAL_FREQ;
    this.hasPllLock = false;
    this.shadowRegs = new Uint8Array(R8xx.REGISTERS);
  }

  /**
   * Sets the tuner's frequency.
   * @param freq The frequency to tune to.
   * @returns a promise that resolves to the actual tuned frequency.
   */
  async setFrequency(freq: number): Promise<number> {
    await this._setMux(freq + R8xx.IF_FREQ);
    let actual = await this._setPll(freq + R8xx.IF_FREQ);
    return actual - R8xx.IF_FREQ;
  }

  /** Starts the tuner. */
  async open() {
    // Demod Page 1, Reg 0xb1: [0] Disable Zero-IF input (low-IF mode), [1] Enable DC estimation, [3] Enable IQ compensation, [4] Enable IQ estimation
    await this.com.setDemodReg(1, 0xb1, 0b00011010, 1);
    // Demod Page 0, Reg 0x08: [7] Disable ADC_I, [6] Enable ADC_Q (tuner IF output is routed to Q ADC)
    await this.com.setDemodReg(0, 0x08, 0b01001101, 1);
    // Demod Page 1, Reg 0x15: [0] Inverted spectrum (matches lower-sideband low-IF mixing)
    await this.com.setDemodReg(1, 0x15, 0b00000001, 1);
    await this.com.openI2C();
    // Initialize tuner registers 0x05 through 0x1f with baseline configuration
    this.shadowRegs = new Uint8Array(R8xx.REGISTERS);
    for (let i = 0; i < this.shadowRegs.length; ++i) {
      await this.com.setI2CReg(this.i2c, i + 5, this.shadowRegs[i]);
    }
    await this._initElectronics();
    await this.com.closeI2C();
  }

  /** Stops the tuner. */
  async close() {
    await this.com.openI2C();
    // Reg 0x06: [7] Power detector 1 off, [6] Power detector 3 narrowband off, [5] Filter gain +3dB, [4] Mixer 6MHz filter on, [2:0] LNA power 1
    await this._writeRegMask(0x06, 0b10110001, 0xff);
    // Reg 0x05: [7] Loop-through off, [5] LNA 1 power off, [4] LNA gain manual, [3:0] LNA manual gain 3
    await this._writeRegMask(0x05, 0b10110011, 0xff);
    // Reg 0x07: [6] Mixer power off, [5] Mixer normal current, [4] Mixer gain auto, [3:0] Mixer gain 10
    await this._writeRegMask(0x07, 0b00111010, 0xff);
    // Reg 0x08: [7] Mixer buffer power off, [6] Mixer buffer low current, [5:0] Image gain 0
    await this._writeRegMask(0x08, 0b01000000, 0xff);
    // Reg 0x09: [7] IF filter power off, [6] IF filter low current, [5:0] Image phase 0
    await this._writeRegMask(0x09, 0b11000000, 0xff);
    // Reg 0x0a: [7] Channel filter power off, [6:5] Filter power level 1, [3:0] Filter bandwidth 6
    await this._writeRegMask(0x0a, 0b00111010, 0xff);
    // Reg 0x0c: [6] IF VGA power off, [4] VGA gain controlled by pin, [3:0] VGA gain 5.5dB
    await this._writeRegMask(0x0c, 0b00110101, 0xff);
    // Reg 0x0f: [6:5] LDO 3.0V, [4] Clock output off, [1] Internal AGC clock on
    await this._writeRegMask(0x0f, 0b01101000, 0xff);
    // Reg 0x11: [7:6] PLL analog regulator off, [2:0] Reference bias 3
    await this._writeRegMask(0x11, 0b00000011, 0xff);
    // Reg 0x17: [7:6] PLL digital regulator off, [5:4] Prescaler current 150uA, [3] Open-drain high-Z
    await this._writeRegMask(0x17, 0b11110100, 0xff);
    // Reg 0x19: [7] RF filter power off, [4] AGC pin = agc_in
    await this._writeRegMask(0x19, 0b00001100, 0xff);
    await this.com.closeI2C();
  }

  /** Sets the tuner to automatic gain. */
  async setAutoGain() {
    // Reg 0x05: [4] LNA gain mode automatic (0 = auto AGC, 1 = manual)
    await this._writeRegMask(0x05, 0b00000000, 0b00010000);
    // Reg 0x07: [4] Mixer gain mode automatic (1 = auto AGC, 0 = manual)
    await this._writeRegMask(0x07, 0b00010000, 0b00010000);
    // Reg 0x0c: [4] IF VGA gain mode manual (0 = manual, 1 = pin), [3:0] IF VGA gain 26.5dB (code 11)
    await this._writeRegMask(0x0c, 0b00001011, 0b10011111);
  }

  /**
   * Sets the tuner's manual gain.
   * @param gain The tuner's gain, in dB.
   */
  async setManualGain(gain: number) {
    // Experimentally, LNA goes in 2.3dB steps, Mixer in 1.2dB steps.
    let fullsteps = Math.floor(gain / 3.5);
    let halfsteps = gain - 3.5 * fullsteps >= 2.3 ? 1 : 0;
    if (fullsteps < 0) fullsteps = 0;
    if (fullsteps > 15) fullsteps = 15;
    if (fullsteps == 15) halfsteps = 0;
    let lnaValue = fullsteps + halfsteps;
    let mixerValue = fullsteps;
    // Reg 0x05: [4] LNA gain mode manual (1 = manual, 0 = auto)
    await this._writeRegMask(0x05, 0b00010000, 0b00010000);
    // Reg 0x07: [4] Mixer gain mode manual (0 = manual, 1 = auto)
    await this._writeRegMask(0x07, 0b00000000, 0b00010000);
    // Reg 0x0c: [4] IF VGA gain mode manual (0 = manual), [3:0] IF VGA gain 16dB (code 8)
    await this._writeRegMask(0x0c, 0b00001000, 0b10011111);
    // Reg 0x05: [3:0] LNA manual gain code (0..15)
    await this._writeRegMask(0x05, lnaValue, 0b00001111);
    // Reg 0x07: [3:0] Mixer manual gain code (0..15)
    await this._writeRegMask(0x07, mixerValue, 0b00001111);
  }

  setXtalFrequency(xtalFreq: number) {
    this.xtalFreq = xtalFreq;
  }

  getIntermediateFrequency(): number {
    return R8xx.IF_FREQ;
  }

  getMinimumFrequency(): number {
    return R8xx.XTAL_FREQ;
  }

  /** Calibrates the filters. */
  private async _calibrateFilter(): Promise<number> {
    let firstTry = true;
    while (true) {
      // Reg 0x0b: [6:5] Set manual coarse filter bandwidth to narrowest
      await this._writeRegMask(0x0b, 0b01100000, 0b01100000);
      // Reg 0x0f: [2] Enable channel filter calibration clock
      await this._writeRegMask(0x0f, 0b00000100, 0b00000100);
      // Reg 0x10: [1:0] Set internal crystal load capacitance to 0 pF (no cap)
      await this._writeRegMask(0x10, 0b00000000, 0b00000011);
      await this._setPll(56000000);
      if (!this.hasPllLock) {
        throw new RadioError(
          "PLL not locked -- cannot tune to the selected frequency.",
          RadioErrorType.TunerError
        );
      }
      // Reg 0x0b: [4] Trigger channel filter auto-calibration start
      await this._writeRegMask(0x0b, 0b00010000, 0b00010000);
      // Reg 0x0b: [4] Reset calibration start bit
      await this._writeRegMask(0x0b, 0b00000000, 0b00010000);
      // Reg 0x0f: [2] Disable channel filter calibration clock
      await this._writeRegMask(0x0f, 0b00000000, 0b00000100);
      let data = await this._readRegBuffer(0x00, 5);
      let arr = new Uint8Array(data);
      // Read Byte 4: [3:0] Measured filter capacitor calibration code
      let filterCap = arr[4] & 0b00001111;
      if (filterCap == 0b00001111) {
        filterCap = 0;
      }
      if (filterCap == 0 || !firstTry) {
        return filterCap;
      }
      firstTry = false;
    }
  }

  /**
   * Sets the multiplexer's frequency.
   * @param freq The frequency to set.
   */
  private async _setMux(freq: number) {
    let freqMhz = freq / 1000000;
    let i;
    for (i = 0; i < this.muxCfgs.length - 1; ++i) {
      if (freqMhz < this.muxCfgs[i + 1][0]) {
        break;
      }
    }
    let cfg = this.muxCfgs[i];
    // Reg 0x17: [3] Open drain control (0 = low impedance, 1 = high-Z)
    await this._writeRegMask(0x17, cfg[1], 0b00001000);
    // Reg 0x1a: [7:6] Tracking filter bypass, [1:0] RF filter band selection
    await this._writeRegMask(0x1a, cfg[2], 0b11000011);
    // Reg 0x1b: [7:4] Low-pass notch filter (LPNF), [3:0] Low-pass filter (LPF)
    await this._writeRegMask(0x1b, cfg[3], 0b11111111);
    // Reg 0x10: [3] Crystal swing high, [1:0] Crystal load cap 0 pF
    await this._writeRegMask(0x10, 0b00000000, 0b00001011);
    // Reg 0x08: [5:0] Image gain calibration adjustment reset to 0
    await this._writeRegMask(0x08, 0b00000000, 0b00111111);
    // Reg 0x09: [5:0] Image phase calibration adjustment reset to 0
    await this._writeRegMask(0x09, 0b00000000, 0b00111111);
  }

  /**
   * Sets the PLL's frequency.
   * @param freq The frequency to set.
   * @returns a promise that resolves to the actual frequency set, or to 0 if the frequency is not achievable.
   */
  private async _setPll(freq: number): Promise<number> {
    let pllRef = Math.floor(this.xtalFreq);
    // Reg 0x10: [4] PLL reference clock divider 1:1 (refdiv2 = 0)
    await this._writeRegMask(0x10, 0b00000000, 0b00010000);
    // Reg 0x1a: [3:2] PLL auto-tune clock rate 128 kHz during VCO configuration
    await this._writeRegMask(0x1a, 0b00000000, 0b00001100);
    // Reg 0x12: [7:5] VCO core current level 4 (mid)
    await this._writeRegMask(0x12, 0b10000000, 0b11100000);
    let divNum = Math.max(
      0,
      Math.min(6, Math.floor(Math.log(1770000000 / freq) / Math.LN2))
    );
    let mixDiv = 1 << (divNum + 1);
    let data = await this._readRegBuffer(0x00, 5);
    let arr = new Uint8Array(data);
    // Read Byte 4: [5:4] VCO fine tune bits
    let vcoFineTune = (arr[4] & 0x30) >> 4;
    if (vcoFineTune > this.vcoPowerRef) {
      divNum = Math.max(0, divNum - 1);
    } else if (vcoFineTune < this.vcoPowerRef) {
      divNum = Math.min(6, divNum + 1);
    }
    // Reg 0x10: [7:5] PLL to mixer divider (divNum: 0=1/2, 1=1/4, 2=1/8, 3=1/16, 4=1/32, 5=1/64)
    await this._writeRegMask(0x10, divNum << 5, 0b11100000);
    let vcoFreq = freq * mixDiv;
    let nint = Math.floor(vcoFreq / (2 * pllRef));
    let vcoFra = vcoFreq % (2 * pllRef);
    if (nint > 63) {
      this.hasPllLock = false;
      return 0;
    }
    let ni = Math.floor((nint - 13) / 4);
    let si = (nint - 13) % 4;
    // Reg 0x14: [7:6] si (phase splitter 2-bit remainder), [5:0] ni (integer divider word)
    await this._writeRegMask(0x14, ni + (si << 6), 0b11111111);
    // Reg 0x12: [3] Sigma-delta dither/power (0 = fractional-N active, 1 = integer-N)
    await this._writeRegMask(0x12, vcoFra == 0 ? 0b1000 : 0b0000, 0b00001000);
    let sdm = Math.min(65535, Math.floor((32768 * vcoFra) / pllRef));
    // Reg 0x16: SDM fractional division value high byte [16:9]
    await this._writeRegMask(0x16, sdm >> 8, 0b11111111);
    // Reg 0x15: SDM fractional division value low byte [8:1]
    await this._writeRegMask(0x15, sdm & 0xff, 0b11111111);
    await this._getPllLock();
    // Reg 0x1a: [3:2] PLL auto-tune clock rate 8 kHz (settled operation)
    await this._writeRegMask(0x1a, 0b00001000, 0b00001000);
    return (2 * pllRef * (nint + sdm / 65536)) / mixDiv;
  }

  /**
   * Checks whether the PLL has achieved lock.
   */
  private async _getPllLock() {
    let firstTry = true;
    while (true) {
      for (let i = 1; i <= 4; ++i) {
        let data = await this._readRegBuffer(0x00, 3);
        let arr = new Uint8Array(data);
        // Read Byte 2: [6] PLL lock status (1 = locked, 0 = not locked)
        if (arr[2] & 0b01000000) {
          this.hasPllLock = true;
          return;
        }
        // Wait 1, 2, 3, and 4 milliseconds before retrying.
        await new Promise(r => setTimeout(r, i));
      }
      if (!firstTry) {
        this.hasPllLock = false;
        return;
      }
      // Reg 0x12: [7:5] Boost VCO core current to level 3 (0b011) if lock failed on first attempt
      await this._writeRegMask(0x12, 0b01100000, 0b11100000);
      firstTry = false;
    }
  }

  /** Initializes all the components of the tuner. */
  private async _initElectronics() {
    // Reg 0x0c: [3:0] IF variable gain amplifier (VGA) initial gain -12 dB
    await this._writeRegMask(0x0c, 0b00000000, 0b00001111);
    // Reg 0x13: [5:0] VCO frequency band 49 (0b110001)
    await this._writeRegMask(0x13, 0b00110001, 0b00111111);
    // Reg 0x1d: [5:3] Power detector 1 take-over point (TOP) 0
    await this._writeRegMask(0x1d, 0b00000000, 0b00111000);
    let filterCap = await this._calibrateFilter();
    // Reg 0x0a: [4] Channel filter high Q, [3:0] Channel filter fine tune bandwidth code
    await this._writeRegMask(0x0a, 0b00010000 | filterCap, 0b00011111);
    // Reg 0x0b: [7:5] Coarse filter bandwidth 3, [3:0] High-pass filter corner frequency 11
    await this._writeRegMask(0x0b, 0b01101011, 0b11101111);
    // Reg 0x07: [7] Mixer sideband selection (0 = lower, 1 = upper)
    await this._writeRegMask(0x07, 0b00000000, 0b10000000);
    // Reg 0x06: [5] Filter gain 0 dB, [4] Mixer 6 MHz channel filter enable
    await this._writeRegMask(0x06, 0b00010000, 0b00110000);
    // Reg 0x1e: [6] Filter extension enable, [5] Channel filter extension at maximum LNA gain
    await this._writeRegMask(0x1e, 0b01000000, 0b01100000);
    // Reg 0x05: [7] Loop-through amplifier power on (0 = on, 1 = off)
    await this._writeRegMask(0x05, 0b00000000, 0b10000000);
    // Reg 0x1f: [7] Loop-through attenuation enable
    await this._writeRegMask(0x1f, 0b00000000, 0b10000000);
    // Reg 0x0f: [7] Filter extension widest mode off
    await this._writeRegMask(0x0f, 0b00000000, 0b10000000);
    // Reg 0x19: [6:5] RF polyphase filter bias current minimum
    await this._writeRegMask(0x19, 0b01100000, 0b01100000);
    // Reg 0x1d: [7:6] LNA narrow-band power detector lowest bandwidth, [2:0] Power detector 2 TOP 5
    await this._writeRegMask(0x1d, 0b11100101, 0b11000111);
    // Reg 0x1c: [7:4] Power detector 3 TOP 4
    await this._writeRegMask(0x1c, 0b00100100, 0b11111000);
    // Reg 0x0d: [7:4] LNA AGC power detector high threshold 0.84V, [3:0] Low threshold 0.64V
    await this._writeRegMask(0x0d, 0b01010011, 0b11111111);
    // Reg 0x0e: [7:4] Mixer AGC power detector high threshold 1.04V, [3:0] Low threshold 0.84V
    await this._writeRegMask(0x0e, 0b01110101, 0b11111111);
    // Reg 0x05: [6] Cable 1 LNA off, [5] LNA 1 power on
    await this._writeRegMask(0x05, 0b00000000, 0b01100000);
    // Reg 0x06: [3] Cable 2 LNA off
    await this._writeRegMask(0x06, 0b00000000, 0b00001000);
    // Reg 0x11: [3] Analog calibration bias control
    await this._writeRegMask(0x11, 0b00111000, 0b00001000);
    // Reg 0x17: [5:4] Prescaler 4/5 bias current 150uA
    await this._writeRegMask(0x17, 0b00110000, 0b00110000);
    // Reg 0x0a: [6:5] Filter power level 2
    await this._writeRegMask(0x0a, 0b01000000, 0b01100000);
    // Reg 0x1d: [5:3] Power detector 1 TOP 0
    await this._writeRegMask(0x1d, 0b00000000, 0b00111000);
    // Reg 0x1c: [2] LNA power detector discharge mode normal
    await this._writeRegMask(0x1c, 0b00000000, 0b00000100);
    // Reg 0x06: [6] LNA power detector narrow band off
    await this._writeRegMask(0x06, 0b00000000, 0b01000000);
    // Reg 0x1a: [5:4] Internal AGC clock period 20 ms
    await this._writeRegMask(0x1a, 0b00110000, 0b00110000);
    // Reg 0x1d: [5:3] Power detector 1 TOP 3
    await this._writeRegMask(0x1d, 0b00011000, 0b00111000);
    // Reg 0x1c: [2] LNA power detector 1 low discharge mode
    await this._writeRegMask(0x1c, 0b00100100, 0b00000100);
    // Reg 0x1e: [4:0] LNA discharge current code 13
    await this._writeRegMask(0x1e, 0b00001101, 0b00011111);
    // Reg 0x1a: [5:4] Internal AGC clock period 80 ms
    await this._writeRegMask(0x1a, 0b00100000, 0b00110000);
  }

  /**
   * Reads a series of registers into a buffer.
   * @param addr The first register's address to read.
   * @param length The number of registers to read.
   * @returns a promise that resolves to an ArrayBuffer with the data.
   */
  protected async _readRegBuffer(
    addr: number,
    length: number
  ): Promise<ArrayBuffer> {
    let data = await this.com.getI2CRegBuffer(this.i2c, addr, length);
    let buf = new Uint8Array(data);
    for (let i = 0; i < buf.length; ++i) {
      let b = buf[i];
      buf[i] = (R8xx.BIT_REVS[b & 0xf] << 4) | R8xx.BIT_REVS[b >> 4];
    }
    return buf.buffer;
  }

  /**
   * Writes a masked value into a register.
   * @param addr The address of the register to write into.
   * @param value The value to write.
   * @param mask A mask that specifies which bits to write.
   */
  protected async _writeRegMask(addr: number, value: number, mask: number) {
    let rc = this.shadowRegs[addr - 5];
    let val = (rc & ~mask) | (value & mask);
    this.shadowRegs[addr - 5] = val;
    await this.com.setI2CReg(this.i2c, addr, val);
  }
}
