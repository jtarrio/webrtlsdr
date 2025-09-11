// Copyright 2025 Jacobo Tarrio Barreiro. All rights reserved.
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

/** Exports the `Demodulator` class with all the demodulation schemes already registered. */

export * from "./empty-demodulator.js";
import { registerDemod } from "./modes.js";
import { ConfigAM, DemodAM } from "./demod-am.js";
import { ConfigCW, DemodCW } from "./demod-cw.js";
import { ConfigNBFM, DemodNBFM } from "./demod-nbfm.js";
import { ConfigSSB, DemodSSB } from "./demod-ssb.js";
import { ConfigWBFM, DemodWBFM } from "./demod-wbfm.js";

registerDemod("WBFM", DemodWBFM, ConfigWBFM);
registerDemod("NBFM", DemodNBFM, ConfigNBFM);
registerDemod("AM", DemodAM, ConfigAM);
registerDemod("USB", DemodSSB, ConfigSSB);
registerDemod("LSB", DemodSSB, ConfigSSB);
registerDemod("CW", DemodCW, ConfigCW);
