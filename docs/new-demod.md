# Creating demodulators for Web RTL-SDR

Web RTL-SDR comes with support for FM (wideband and narrowband), AM, SSB, and CW, but if your application needs to support additional modulation schemes, you can add them.

## Create a new modulation scheme

In Web RTL-SDR, a modulation scheme has the following elements:

- A short name, or "scheme name." It should be a short word or initialism, like "WBFM," "AM," or "USB."
- Mode parameters. This is an object that stores the configuration for the demodulator: bandwidth, maximum deviation, squelch level, whether stereo is enabled, etc.
- A demodulator. This is a class with a method that takes I/Q samples as its input and produces audio samples.
- A configurator. This is a class that provides a unified interface to change the mode parameters. This lets you write applications that can change the mode parameters without having to write specific code for each mode.

### Choose a scheme name

Web RTL-SDR uses this scheme name internally to refer to your modulation scheme. Many programs will also show these names to the user, so your scheme name should be short, uncomplicated, and human-friendly.

#### Example

For a double-sideband suppressed-carrier demodulator, a good name would be `DSB`, an acceptable name would be `DoubleSideband`, and a poor name would be `927492`.

### Define the mode parameters type

You always need to provide a mode parameters type, even if your modulation scheme is not configurable.

Your mode parameters must be contained in an object with a field named `scheme`. This field must always contain the scheme name you chose. You may define other fields of the object as you wish. However, keep in mind that some programs may want to save their configuration in JSON format, so your mode parameters should be serializable.

#### Example

For a double-sideband suppressed-carrier demodulator, your mode parameters could look like this in TypeScript:

```typescript
type ModeDSB = { scheme: "DSB"; bandwidth: number };
```

### Define the demodulator

Your demodulator must implement the [`Demod<M extends Mode>`](../src/demod/modes.ts) interface, which contains the following methods:

- `getMode(): M` — returns the current mode parameters.
- `setMode(mode: M)` — sets the new mode parameters.
- `demodulate(I: Float32Array, Q: Float32Array, freqOffset: number): Demodulated` — demodulates the `I`/`Q` signal at frequency `freqOffset` and returns the demodulated audio as a `Demodulated` object (described below).

Your [`Demod<M extends Mode>`](../src/demod/modes.ts) object must also have a constructor with this form:

- `constructor(inRate: number, private outRate: number, mode: M)` — takes the input sample rate, output sample rate, and the initial mode parameters.

The [`Demodulated`](../src/demod/modes.ts) object has the following fields:

- `left: Float32Array` — the samples for the left speaker.
- `right: Float32Array` — the samples for the right speaker.
- `stereo: boolean` — whether the signal was demodulated in stereo.
- `snr: number` — an estimate of the signal-to-noise ratio (in units of s/n, not dB).

#### Example

A demodulator for a double-sideband suppressed carrier signal could look like this in Typescript:

```typescript
import { Demod, Demodulated } from "@jtarrio/webrtlsdr/demod/modes";

class DemodDSB implements Demod<ModeDSB> {
  constructor(inRate: number, private outRate: number, private mode: ModeDSB) {
    this.shifter = new FrequencyShifter(inRate);
    this.downsampler = new ComplexDownsampler(inRate, outRate, 151);
    const kernel = makeLowPassKernel(outRate, mode.bandwidth / 2, 351);
    this.filterI = new FIRFilter(kernel);
    this.filterQ = new FIRFilter(kernel);
  }

  private shifter: FrequencyShifter;
  private downsampler: ComplexDownsampler;
  private filterI: FIRFilter;
  private filterQ: FIRFilter;

  getMode(): ModeCW {
    return this.mode;
  }

  setMode(mode: ModeCW) {
    this.mode = mode;
    const kernel = makeLowPassKernel(this.outRate, mode.bandwidth / 2, 151);
    this.filterI.setCoefficients(kernel);
    this.filterQ.setCoefficients(kernel);
  }

  demodulate(
    samplesI: Float32Array,
    samplesQ: Float32Array,
    freqOffset: number
  ): Demodulated {
    this.shifter.inPlace(samplesI, samplesQ, -freqOffset);
    const [I, Q] = this.downsampler.downsample(samplesI, samplesQ);
    let allPower = getPower(I, Q);
    this.filterI.inPlace(I);
    this.filterQ.inPlace(Q);
    let signalPower = (getPower(I, Q) * this.outRate) / this.mode.bandwidth;
    return {
      left: I,
      right: new Float32Array(I),
      stereo: false,
      snr: signalPower / allPower,
    };
  }
}
```

### Define the configurator

To write your configurator, you must extend the [`Parameters<M extends Mode>`](../src/demod/modes.ts) class. You will need to override at least two methods:

- `create(scheme: string)` — it must return a mode parameters object with the default settings.
- `getBandwidth(): number` — it must return the bandwidth used by the mode.

Additionally, if any parameters are settable (bandwidth, stereo, squelch), you must override their corresponding `hasXxx()`, `getXxx()`, and `setXxx()` methods so they will do the appropriate operations. Note that the `setXxx()` methods must not modify the mode parameters object in place. Look at the example to see how it's done.

#### Example

A configurator for the DSB scheme could look like this in TypeScript:

```typescript
import { Configurator } from "@jtarrio/webrtlsdr/demod/modes";

export class ConfigDSB extends Configurator<ModeDSB> {
  constructor(mode: ModeDSB | string) {
    super(mode);
  }
  protected create(): ModeDSB {
    return { scheme: "DSB", bandwidth: 15000 };
  }
  hasBandwidth(): boolean {
    return true;
  }
  getBandwidth(): number {
    return this.mode.bandwidth;
  }
  setBandwidth(bandwidth: number): ConfigCW {
    bandwidth = Math.max(250, Math.min(bandwidth, 30000));
    // Do not do this:
    // this.mode.bandwidth = bandwidth
    // Do this instead:
    this.mode = { ...this.mode, bandwidth: bandwidth };
    // This creates a copy of `this.mode`, changes its `bandwidth` field, and then sets `this.mode` to the result.
    return this;
  }
}
```

## Use your modulation scheme

### Register the modulation scheme

Register the modulation scheme with the `registerDemod()` function. Its arguments are the scheme name, the demodulator class, and the configurator class.

After you register the scheme, it will become available through the `getSchemes()`, `getMode()`, `getDemod()`, and `modeParameters()` functions.

#### Example

```typescript
import { registerDemod } from "@jtarrio/webrtlsdr/demod/modes";

registerDemod("WBFM", DemodWBFM, ConfigWBFM);
```

### The Demodulator

After you register your demodulation scheme, it will become available to the [`Demodulator`](../src/demod/empty-demodulator.ts) class.

When you import the demodulator through the `@jtarrio/webrtlsdr/demod/demodulator` module, some modulation schemes will be registered by default. If you don't want them, you can import the demodulator through the `@jtarrio/webrtlsdr/demod/empty-demodulator` module instead.

#### Example

Default demodulator:

```typescript
import { Demodulator } from "@jtarrio/webrtlsdr/demod/demodulator";
import { getSchemes } from "@jtarrio/webrtlsdr/demod/modes";

console.log(getSchemes()); // WBFM, NBFM, AM, USB, LSB, CW
```

Empty demodulator:

```typescript
import { Demodulator } from "@jtarrio/webrtlsdr/demod/empty-demodulator";
import { getSchemes } from "@jtarrio/webrtlsdr/demod/modes";

console.log(getSchemes()); // (empty)
```

## Add extra demodulation to WBFM

In WBFM, the demodulated signal often has some extra information modulated within it:

- Stereo signals contain a pilot tone at 19 kHz and a "stereo difference signal" at 38 kHz.
- Some FM stations transmit RDS or RBDS digital signals at 57 kHz.

Web RTL-SDR has the ability to demodulate the stereo signal but not RDS/RBDS. However, it can be extended to add this ability. To that end, the WBFM demodulator is split into two stages:

- [`DemodWBFMStage1`](../src/demod/demod-wbfm.ts) does the FM demodulation and produces the raw signal with the mono audio, pilot, stereo, RDS/RDBS, etc.
- [`DemodWBFMStage2`](../src/demod/demod-wbfm.ts) takes the signal from stage 1 and does stereo separation and reconstruction.

You can build your own WBFM demodulator that uses the output of stage 1 to extract other carriers and signals before sending it to stage 2.

You can even register it as `WBFM` and it will replace the original `WBFM` demodulator.

### Example

```typescript
export class DemodWBFMWithDecoder implements Demod<ModeWBFM> {
  constructor(inRate: number, outRate: number, private mode: ModeWBFM) {
    let interRate = Math.min(inRate, 336000);
    this.stage1 = new DemodWBFMStage1(inRate, interRate, mode);
    this.myDecoder = new MyDecoder(interRate, mode);
    this.stage2 = new DemodWBFMStage2(interRate, outRate, mode);
  }

  private stage1: DemodWBFMStage1;
  private myDecoder: MyDecoder;
  private stage2: DemodWBFMStage2;

  getMode(): ModeWBFM {
    return this.mode;
  }

  setMode(mode: ModeWBFM) {
    this.mode = mode;
    this.stage1.setMode(mode);
    this.myDecoder.setMode(mode);
    this.stage2.setMode(mode);
  }

  demodulate(
    samplesI: Float32Array,
    samplesQ: Float32Array,
    freqOffset: number
  ): Demodulated {
    let o1 = this.stage1.demodulate(samplesI, samplesQ, freqOffset);
    this.myDecoder.decode(o1.left);
    let o2 = this.stage2.demodulate(o1.left);

    o2.snr = o1.snr;
    return o2;
  }
}
```
