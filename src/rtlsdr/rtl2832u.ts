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
import { R820T } from "./r820t.js";
import { R828D } from "./r828d.js";
import { RtlCom } from "./rtlcom.js";
import {
  DirectSampling,
  RtlDevice,
  RtlDeviceProvider,
  SampleBlock,
} from "./rtldevice.js";
import { Tuner } from "./tuner.js";

/** Known RTL2832 devices. */
const TUNERS = [
  { vendorId: 0x0bda, productId: 0x2832 },
  { vendorId: 0x0bda, productId: 0x2838 },
];

/** Options for the RTL2832U_Provider constructor. */
export type RtlOptions = {
  /**
   * An implementation of the WebUSB USB interface to use to talk to the RTL-SDR device.
   * If not specified, `navigator.usb` is used.
   */
  webusb?: USB;
};

/** Class that returns an open RTL2832U device. */
export class RTL2832U_Provider implements RtlDeviceProvider {
  constructor(options?: RtlOptions) {
    this.webusb = options?.webusb || navigator.usb;
    this.device = undefined;
  }

  private webusb?: USB;
  private device?: USBDevice;

  async get(): Promise<RtlDevice> {
    if (this.device === undefined) {
      this.device = await this.getDevice();
    }
    await this.device!.open();
    return RTL2832U.open(this.device!);
  }

  private async getDevice(): Promise<USBDevice> {
    if (this.webusb === undefined) {
      throw new RadioError(
        `This browser does not support the WebUSB API`,
        RadioErrorType.NoUsbSupport,
      );
    }
    try {
      return this.webusb.requestDevice({ filters: TUNERS });
    } catch (e) {
      throw new RadioError(
        `No device was selected`,
        RadioErrorType.NoDeviceSelected,
        { cause: e },
      );
    }
  }
}

/** Operations on the RTL2832U demodulator. */
export class RTL2832U implements RtlDevice {
  /** Frequency of the oscillator crystal. */
  static XTAL_FREQ = 28800000;

  /** The number of bytes for each sample. */
  static BYTES_PER_SAMPLE = 2;

  private constructor(
    private com: RtlCom,
    private tuner: Tuner,
  ) {
    this.centerFrequency = 0;
    this.ppm = 0;
    this.gain = null;
    this.directSamplingMethod = DirectSampling.Off;
    this.directSampling = DirectSampling.Off;
    this.biasTeeEnabled = false;
    this.sampleRate = 0;
  }

  private centerFrequency: number;
  private ppm: number;
  private gain: number | null;
  private directSamplingMethod: DirectSampling;
  private directSampling: DirectSampling;
  private biasTeeEnabled: boolean;
  private sampleRate: number;

  /**
   * Initializes the demodulator.
   * @param device The USB device.
   */
  static async open(device: USBDevice): Promise<RTL2832U> {
    let com = new RtlCom(device);
    await com.claimInterface();

    await RTL2832U._init(com);
    let tuner = await RTL2832U._findTuner(com);
    let rtl = new RTL2832U(com, tuner);
    await rtl.setGain(rtl.gain);
    await rtl.setFrequencyCorrection(rtl.ppm);
    return rtl;
  }

  private static async _init(com: RtlCom) {
    // USB_SYSCTL (0x2000): [0] DMA enable, [3] Full packet mode
    await com.setUsbReg(0x2000, 0b00001001, 1);
    // USB_EPA_MAXPKT (0x2158): Max packet size = 512 bytes (0x0200) for high-speed USB bulk transfers
    await com.setUsbReg(0x2158, 0x0200, 2);
    // USB_EPA_CTL (0x2148): [4] Stall endpoint, [9] FIFO reset (0x0210 in little-endian)
    await com.setUsbReg(0x2148, 0b0000001000010000, 2);
    // SYS_DEMOD_CTL1 (0x300b): Powers on demodulator analog circuitry and clock (0x22)
    await com.setSysReg(0x300b, 0b00100010);
    // SYS_DEMOD_CTL (0x3000): [7] Demod PLL enable, [6] ADC_I enable, [5] Release demod reset, [3] ADC_Q enable
    await com.setSysReg(0x3000, 0b11101000);
    // Demod Page 1, Reg 0x01: Soft reset demodulator (assert [2] soft_rst with 0x14, then deassert with 0x10)
    await com.setDemodReg(1, 0x01, 0b00010100, 1);
    await com.setDemodReg(1, 0x01, 0b00010000, 1);
    // Demod Page 1, Reg 0x15: [0] Spectrum inversion disabled, [1] Adjacent channel rejection disabled
    await com.setDemodReg(1, 0x15, 0b00000000, 1);
    // Demod Page 1, Regs 0x16-0x18: Carrier frequency offset [21:0] initialized to 0
    await com.setDemodReg(1, 0x16, 0x00, 1);
    await com.setDemodReg(1, 0x17, 0x00, 1);
    await com.setDemodReg(1, 0x18, 0x00, 1);
    // Demod Page 1, Regs 0x19-0x1b: Intermediate frequency (IF) registers [21:0] initialized to 0
    await com.setDemodReg(1, 0x19, 0x00, 1);
    await com.setDemodReg(1, 0x1a, 0x00, 1);
    await com.setDemodReg(1, 0x1b, 0x00, 1);
    // Demod Page 1, Regs 0x1c-0x2f: 16-tap decimation FIR filter coefficients (8 8-bit taps + 8 12-bit packed taps = 20 bytes)
    await com.setDemodReg(1, 0x1c, 0xca, 1);
    await com.setDemodReg(1, 0x1d, 0xdc, 1);
    await com.setDemodReg(1, 0x1e, 0xd7, 1);
    await com.setDemodReg(1, 0x1f, 0xd8, 1);
    await com.setDemodReg(1, 0x20, 0xe0, 1);
    await com.setDemodReg(1, 0x21, 0xf2, 1);
    await com.setDemodReg(1, 0x22, 0x0e, 1);
    await com.setDemodReg(1, 0x23, 0x35, 1);
    await com.setDemodReg(1, 0x24, 0x06, 1);
    await com.setDemodReg(1, 0x25, 0x50, 1);
    await com.setDemodReg(1, 0x26, 0x9c, 1);
    await com.setDemodReg(1, 0x27, 0x0d, 1);
    await com.setDemodReg(1, 0x28, 0x71, 1);
    await com.setDemodReg(1, 0x29, 0x11, 1);
    await com.setDemodReg(1, 0x2a, 0x14, 1);
    await com.setDemodReg(1, 0x2b, 0x71, 1);
    await com.setDemodReg(1, 0x2c, 0x74, 1);
    await com.setDemodReg(1, 0x2d, 0x19, 1);
    await com.setDemodReg(1, 0x2e, 0x41, 1);
    await com.setDemodReg(1, 0x2f, 0xa5, 1);
    // Demod Page 0, Reg 0x19: [2] Enable SDR mode, [5] Disable Digital AGC (DAGC)
    await com.setDemodReg(0, 0x19, 0b00000101, 1);
    // Demod Page 1, Regs 0x93-0x94: Initialize FSM (Finite State Machine) state-holding registers
    await com.setDemodReg(1, 0x93, 0b11110000, 1);
    await com.setDemodReg(1, 0x94, 0b00001111, 1);
    // Demod Page 1, Reg 0x11: [0] Disable DAGC
    await com.setDemodReg(1, 0x11, 0b00000000, 1);
    // Demod Page 1, Reg 0x04: [4:1] Disable RF/IF hardware AGC loop (loop gain set to 0)
    await com.setDemodReg(1, 0x04, 0b00000000, 1);
    // Demod Page 0, Reg 0x61: [5] Pass error packets, [6] Disable PID filter for raw SDR streaming
    await com.setDemodReg(0, 0x61, 0b01100000, 1);
    // Demod Page 0, Reg 0x06: [7] Fixed 1, [5:4] Default ADC_I/ADC_Q datapath (0b00)
    await com.setDemodReg(0, 0x06, 0b10000000, 1);
    // Demod Page 1, Reg 0xb1: [0] Enable Zero-IF baseband input (DVBT_EN_BBIN), [1] DC estimation, [3] IQ compensation, [4] IQ estimation
    await com.setDemodReg(1, 0xb1, 0b00011011, 1);
    // Demod Page 0, Reg 0x0d: Disable 4.096 MHz clock output on test point TP_CK0 to eliminate internal clock interference
    await com.setDemodReg(0, 0x0d, 0b10000011, 1);
  }

  /** Finds the tuner that's connected to this demodulator and returns the appropriate instance. */
  private static async _findTuner(com: RtlCom): Promise<Tuner> {
    let tuner = await R820T.maybeInit(com);
    if (tuner === null) tuner = await R828D.maybeInit(com);
    if (tuner === null) {
      await com.releaseInterface();
      throw new RadioError(
        "Sorry, your USB dongle has an unsupported tuner chip.",
        RadioErrorType.UnsupportedDevice,
      );
    }
    return tuner;
  }

  /**
   * Set the sample rate.
   * @param rate The sample rate, in samples/sec.
   * @returns a promise that resolves to the sample rate that was actually set.
   */
  async setSampleRate(rate: number): Promise<number> {
    this.sampleRate = rate;
    let ratio = Math.floor((this._getXtalFrequency() * (1 << 22)) / rate);
    ratio &= 0x0ffffffc;
    let realRate = Math.floor((this._getXtalFrequency() * (1 << 22)) / ratio);
    // Demod Page 1, Regs 0x9f & 0xa1: Resample ratio [27:2] (RSAMP_RATIO)
    // ratio = floor((xtal * 2^22) / rate) & 0x0ffffffc
    await this.com.setDemodReg(1, 0x9f, (ratio >> 16) & 0xffff, 2);
    await this.com.setDemodReg(1, 0xa1, ratio & 0xffff, 2);
    await this._resetDemodulator();
    return realRate;
  }

  async setFrequencyCorrection(ppm: number) {
    this.ppm = ppm;
    let ppmOffset = -1 * Math.floor((this.ppm * (1 << 24)) / 1000000);
    // Demod Page 1, Regs 0x3e [13:8] & 0x3f [7:0]: Sampling frequency offset
    await this.com.setDemodReg(1, 0x3e, (ppmOffset >> 8) & 0x3f, 1);
    await this.com.setDemodReg(1, 0x3f, ppmOffset & 0xff, 1);
    let xtalFrequency = this._getXtalFrequency();
    this.tuner.setXtalFrequency(xtalFrequency);
    let ifFreq = this.tuner.getIntermediateFrequency();
    if (ifFreq != 0) {
      await this._setIfFrequency(ifFreq);
    }
    if (this.centerFrequency != 0) {
      await this.setCenterFrequency(this.centerFrequency);
    }
    if (this.sampleRate != 0) {
      await this.setSampleRate(this.sampleRate);
    }
  }

  private async _setIfFrequency(ifFreq: number): Promise<number> {
    let xtalFrequency = this._getXtalFrequency();
    let multiplier = -1 * Math.floor((ifFreq * (1 << 22)) / xtalFrequency);
    // Demod Page 1, Regs 0x19-0x1b: Digital down-converter intermediate frequency (IF) multiplier [21:0]
    await this.com.setDemodReg(1, 0x19, (multiplier >> 16) & 0x3f, 1);
    await this.com.setDemodReg(1, 0x1a, (multiplier >> 8) & 0xff, 1);
    await this.com.setDemodReg(1, 0x1b, multiplier & 0xff, 1);
    return Math.floor((-1 * multiplier * xtalFrequency) / (1 << 22));
  }

  getFrequencyCorrection(): number {
    return this.ppm;
  }

  async setGain(gain: number | null) {
    this.gain = gain;
    if (this.directSampling != DirectSampling.Off) {
      await this._enableRtlAgc(gain == null);
    } else {
      await this.com.openI2C();
      if (this.gain === null) {
        await this.tuner.setAutoGain();
      } else {
        await this.tuner.setManualGain(this.gain);
      }
      await this.com.closeI2C();
    }
  }

  getGain(): number | null {
    return this.gain;
  }

  async enableBiasTee(enabled: boolean) {
    this.biasTeeEnabled = enabled;
    await this.com.setGpioOutput(0);
    await this.com.setGpioBit(0, enabled ? 1 : 0);
  }

  isBiasTeeEnabled(): boolean {
    return this.biasTeeEnabled;
  }

  private async _enableRtlAgc(enable: boolean) {
    // Demod Page 0, Reg 0x19: [2] SDR mode, [5] DAGC enable/disable (0x25 = DAGC enabled, 0x05 = DAGC disabled)
    await this.com.setDemodReg(0, 0x19, enable ? 0x25 : 0x05, 1);
  }

  private _getXtalFrequency(): number {
    return Math.floor(RTL2832U.XTAL_FREQ * (1 + this.ppm / 1000000));
  }

  /** Resets the demodulator. */
  private async _resetDemodulator() {
    // Demod Page 1, Reg 0x01: Toggle [2] soft_rst (0x14 asserts reset, 0x10 deasserts)
    await this.com.setDemodReg(1, 0x01, 0b00010100, 1);
    await this.com.setDemodReg(1, 0x01, 0b00010000, 1);
  }

  /**
   * Tunes the device to the given frequency.
   * @param freq The frequency to tune to, in Hertz.
   * @returns a promise that resolves to the actual tuned frequency.
   */
  async setCenterFrequency(freq: number): Promise<number> {
    await this._maybeSetDirectSampling(freq);
    let actualFreq: number;
    if (this.directSampling != DirectSampling.Off) {
      actualFreq = await this._setIfFrequency(freq);
    } else {
      await this.com.openI2C();
      actualFreq = await this.tuner.setFrequency(freq);
      await this.com.closeI2C();
    }
    this.centerFrequency = freq;
    return actualFreq;
  }

  /**
   * Sets the method used for direct sampling mode, or disables it.
   * If enabled, the radio will enter direct sampling mode for low frequencies.
   */
  async setDirectSamplingMethod(method: DirectSampling) {
    if (this.directSamplingMethod == method) return;
    this.directSamplingMethod = method;
    if (this.centerFrequency != 0) {
      await this.setCenterFrequency(this.centerFrequency);
    }
  }

  /** Returns the current direct sampling method. */
  getDirectSamplingMethod(): DirectSampling {
    return this.directSamplingMethod;
  }

  private async _maybeSetDirectSampling(frequency: number) {
    let lowFrequency = frequency < this.tuner.getMinimumFrequency();
    let method = lowFrequency ? this.directSamplingMethod : DirectSampling.Off;
    if (this.directSampling == method) return;
    const tunerWasOn = this.directSampling == DirectSampling.Off;
    const useDirectSampling = method != DirectSampling.Off;
    this.directSampling = method;
    if (useDirectSampling) {
      if (tunerWasOn) {
        await this.tuner.close();
      }
      // Demod Page 1, Reg 0xb1: [0] Disable Zero-IF input (switches demodulator to low-IF direct sampling)
      await this.com.setDemodReg(1, 0xb1, 0b00011010, 1);
      // Demod Page 1, Reg 0x15: [0] Non-inverted spectrum
      await this.com.setDemodReg(1, 0x15, 0b00000000, 1);
      // Demod Page 0, Reg 0x06: [5:4] Select ADC datapath (0b00 for I-branch direct sampling, 0b01 to route Q ADC to I datapath)
      let regValue = method == DirectSampling.I ? 0b10000000 : 0b10010000;
      await this.com.setDemodReg(0, 0x06, regValue, 1);
      await this._enableRtlAgc(this.gain == null);
    } else {
      await this.tuner.open();
      let ifFreq = this.tuner.getIntermediateFrequency();
      if (ifFreq != 0) {
        await this._setIfFrequency(ifFreq);
      }
      // Demod Page 1, Reg 0x15: [0] Inverted spectrum (for tuner low-IF mixing)
      await this.com.setDemodReg(1, 0x15, 0b00000001, 1);
      // Demod Page 0, Reg 0x06: [5:4] Default ADC_I/ADC_Q datapath
      await this.com.setDemodReg(0, 0x06, 0b10000000, 1);
      await this._enableRtlAgc(false);
      await this.setGain(this.getGain());
    }
  }

  /** Resets the sample buffer. Call this before starting to read samples. */
  async resetBuffer() {
    // USB_EPA_CTL (0x2148): [4] Stall endpoint, [9] FIFO reset (0x0210 stalls and resets, 0x0000 clears stall)
    await this.com.setUsbReg(0x2148, 0b0000001000010000, 2);
    await this.com.setUsbReg(0x2148, 0x0000, 2);
  }

  /**
   * Reads a block of samples off the device.
   * @param length The number of samples to read.
   * @returns a promise that resolves to a SampleBlock.
   */
  async readSamples(length: number): Promise<SampleBlock> {
    const data = await this.com.getSamples(length * RTL2832U.BYTES_PER_SAMPLE);
    const frequency = this.centerFrequency;
    const directSampling = this.directSampling != DirectSampling.Off;
    return { frequency, directSampling, data };
  }

  /** Stops the demodulator. */
  async close() {
    await this.tuner.close();
    await this.com.releaseInterface();
    await this.com.close();
  }
}
