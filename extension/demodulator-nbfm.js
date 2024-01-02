"use strict";
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
/**
 * @fileoverview A demodulator for narrowband FM signals.
 */
/**
 * A class to implement a Narrowband FM demodulator.
 */
class Demodulator_NBFM {
    /**
     * @param inRate The sample rate of the input samples.
     * @param outRate The sample rate of the output audio.
     * @param maxF The frequency shift for maximum amplitude.
     */
    constructor(inRate, outRate, maxF) {
        let multiple = 1 + Math.floor((maxF - 1) * 7 / 75000);
        let interRate = 48000 * multiple;
        let filterF = maxF * 0.8;
        this.demodulator = new FMDemodulator(inRate, interRate, maxF, filterF, Math.floor(50 * 7 / multiple));
        let filterCoefs = getLowPassFIRCoeffs(interRate, 8000, 41);
        this.downSampler = new Downsampler(interRate, outRate, filterCoefs);
    }
    demodulator;
    downSampler;
    /**
     * Demodulates the signal.
     * @param samplesI The I components of the samples.
     * @param samplesQ The Q components of the samples.
     * @returns The demodulated audio signal.
     */
    demodulate(samplesI, samplesQ) {
        let demodulated = this.demodulator.demodulateTuned(samplesI, samplesQ);
        let audio = this.downSampler.downsample(demodulated);
        return {
            left: audio.buffer,
            right: new Float32Array(audio).buffer,
            stereo: false,
            signalLevel: this.demodulator.getRelSignalPower()
        };
    }
}
