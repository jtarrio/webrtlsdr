# Web RTL-SDR High-level API

The high-level API lets you operate a multi-mode radio receiver in few lines of code.

This API comprises two parts: the `Radio`, which receives commands from your program, controls the RTL-SDR device, and generates a stream of samples; and the `SampleReceiver`, which receives the sample stream and operates on it.

The API also provides a `Demodulator`, which is a `SampleReceiver` that can demodulate FM, AM, SSB, and CW signals, and play them on the speakers or headphones using the Web Audio API.

## The `Radio` class

### Imports

To use the high-level `Radio` API, import the following modules:

```typescript
import { Radio } from "@jtarrio/webrtlsdr/radio";
import { RTL2832U_Provider } from "@jtarrio/webrtlsdr/rtlsdr";
```

### Create a `Radio`

The constructor for the `Radio` class takes two arguments: an `RtlDeviceProvider` that returns the RTL-SDR device to use, and a `SampleReceiver` that will get the sample stream.

#### Example

We need a `SampleReceiver` to create the `Radio`, so for this example, we'll create one that logs the number of samples that were received in each block. (There will be a full explanation of the `SampleReceiver` interface later.)

```typescript
class MyReceiver {
  setSampleRate(sampleRate) {}
  receiveSamples(I, Q, frequency) {
    console.log("Received", I.length, "samples");
  }
}

let receiver = new MyReceiver();
let radio = new Radio(new RTL2832U_Provider(), receiver);
```

### Start and stop playing

Use the `Radio` object's `start()` and `stop()` methods to start and stop the radio, respectively.

Use the `isPlaying()` method to get the current state.

Note that the `start()` and `stop()` methods may return before the radio is started or stopped. Therefore, if you call `isPlaying()` right after `start()` or `stop()`, you will get the "wrong" result.

You can get notifications when the radio starts and stops playing; to do that, liste on the `radio` event.

#### Example

```typescript
radio.addEventListener("radio", onRadio);

function onRadio(e) {
  if (e.detail.type == "started") console.log("Radio started");
  if (e.detail.type == "stopped") console.log("Radio stopped");
}

// Start the radio
radio.start();

// Stop the radio after 5 seconds
setTimeout(() => radio.stop(), 5000);
```

### Set the parameters

The `Radio` object has multiple methods that let you change the radio parameters and also see their current values. You can call those methods whether the radio is currently playing or not.

Also, note that the methods that set parameters may return before the radio starts using the new value of the parameter. However, their corresponding methods to get the value will always return the last value you set.

#### Sample rate

The sample rate is the number of samples the radio will capture per second. Most RTL-SDR devices seem to work with sample rates between 960,000 and 2,880,000. Some devices can be set to 250,000 samples per second, but with strong aliasing problems.

Due to the Nyquist Theorem, the sample rate also determines the bandwidth of the signal the radio can capture at once: 1 sample per second corresponds to 1 Hertz of bandwidth. Therefore, if you want to increase the bandwidth, you also need to increase the sample rate; if you want to decrease the sample rate, you will also decrease the bandwidth.

You can change the sample rate with the `setSampleRate()` method.

```typescript
radio.setSampleRate(1024000);
```

If the radio is playing when you call `setSampleRate()`, this change won't take effect until you stop and restart the radio.

You can get the current sample rate with the `getSampleRate()` method.

```typescript
console.log("Current sample rate:", radio.getSampleRate());
```

#### Frequency

You can change the frequency that the radio is tuned to. This frequency is the "center frequency" of the band of frequencies received by the radio. For example, if you are receiving 1,500,000 samples per second and are tuned to a center frequency of 101 MHz, you will receive signals from 100.25 MHz to 101.75 MHz.

You can change the frequency with the `setFrequency()` method.

```typescript
radio.setFrequency(88.5 * 1e6);
```

You can check the current frequency with the `getFrequency()` method.

```typescript
console.log("Current frequency:", radio.getFrequency());
```

By default, the radio is tuned to 88.5 MHz.

#### Frequency correction factor

RTL-SDR devices use a crystal oscillator to generate their internal reference signals. Due to manufacturing tolerances and other considerations, most oscillators run at a slightly different frequency than nominal, which makes RTL-SDR devices tune a little bit off-frequency.

You can set a "frequency correction factor" that makes the radio tune slightly up or down to compensate for the inaccuracy in its crystal. This factor is expressed in "parts per million", and you can set it with the `setFrequencyCorrection()` method.

```typescript
radio.setFrequencyCorrection(ppm);
```

You can also check the current frequency correction factor with the `getFrequencyCorrection()` method.

```typescript
console.log("Frequency correction PPM:", radio.getFrequencyCorrection());
```

By default, the radio uses a 0 PPM correction factor.

#### Tuner gain

The tuner in the RTL-SDR device has an amplifier circuit to boost the power of the received signals. You can set the gain of this amplification circuit manually, or you can enable "automatic gain control" to let the RTL-SDR device adjust the gain by itself.

You can configure the gain with the `setGain()` method. Give it a `null` value to enable automatic gain control, or a number to set the gain to that approximate amount in decibels (dB):

```typescript
if (autoGain) {
  radio.setGain(null);
} else {
  radio.setGain(gain);
}
```

You can get the current gain with the `getGain()` method, which returns a number or a `null` value.

```typescript
let gain = radio.getGain();
console.log("Gain:", gain === null ? "auto" : gain);
```

By default, the radio uses automatic gain control.

#### Direct sampling

Most RTL-SDR devices can only receive signals from 29 MHz to 1700 MHz. Some devices, however, have a modification that allows "direct sampling". In direct sampling mode, the tuner circuit is bypassed and the digitizer receives the signals directly; this lets the device receive signals below 29 MHz. Depending on how the modification was made, the bypassed signals are received through the `I` channel or the `Q` channel.

If you want to use direct sampling, you only need to specify the method. You don't need to enable or disable it depending on the frequency; Web RTL-SDR will activate it automatically for frequencies below 29 MHz only.

You can enable direct sampling mode and specify the channel through the `setDirectSamplingMethod()` method.

```typescript
// Disable direct sampling
radio.setDirectSamplingMethod(DirectSampling.Off);
// Enable direct sampling on the Q channel
radio.setDirectSamplingMethod(DirectSampling.Q);
// Enable direct sampling on the I channel
radio.setDirectSamplingMethod(DirectSampling.I);
```

You can also get the current direct sampling method with the `getDirectSamplingMethod()` method.

```typescript
console.log("Direct sampling:", radio.getDirectSamplingMethod());
```

By default, direct sampling is disabled.

#### Bias T

Some RTL-SDR devices have a special circuit, called a "bias T", that can provide power to an external device through the antenna connector.

You can turn the bias T on and off through the `enableBiasTee()` method.

```typescript
radio.enableBiasTee(biasTeeEnabled);
```

You can get the current status of the bias T with the `isBiasTeeEnabled()` method.

```typescript
console.log("Bias T:", radio.isBiasTeeEnabled());
```

By default, the bias T is off.

## The `SampleReceiver` interface

When the `Radio` is playing, it receives a stream of samples from an RTL-SDR device and provides it to a `SampleReceiver` object by calling its `receiveSamples()` method repeatedly.

### Imports

You don't need to import anything if you use JavaScript. If you use TypeScript, you should import the `SampleReceiver` type:

```typescript
import { SampleReceiver } from "@jtarrio/webrtlsdr/radio";
```

### Method `setSampleRate()`

The `setSampleRate()` method is called by the `Radio` whenever a stream starts or the radio's sample rate is changed. It takes a single parameter:

- `sampleRate` (`number`): the new sample rate, as the number of samples per second.

### Method `receiveSamples()`

The `receiveSamples()` method is called by the `Radio` whenever there is a new block of samples. It takes three parameters:

- `I` (`Float32Array`): the successive values of the samples' I components.
- `Q` (`Float32Array`): the successive values of the samples' Q components.
- `frequency` (`number`): the frequency that the RTL-SDR device was tuned to when it received this block of samples.

The `I` and `Q` arrays have the same number of elements, and each element of `I`, together with the element of `Q` with the same index, form one I/Q sample.

### Example

```typescript
class PowerLogger implements SampleReceiver {
  private frequency = 0;

  setSampleRate(sampleRate: number) {
    console.log("New sample rate:", sampleRate);
  }

  receiveSamples(I: Float32Array, Q: Float32Array, frequency: number) {
    if (this.frequency != frequency) {
      console.log("New frequency:", frequency);
      this.frequency = frequency;
    }
    let power = 0;
    for (let i = 0; i < I.length; ++i) {
      power += I[i] * I[i] + Q[i] * Q[i];
    }
    let dB = 10 * Math.log10(power / (u8Samples.length / 2));
    console.log("Power:", dB);
  }
}
```

## The `Demodulator` class

Web RTL-SDR provides a `Demodulator` class, which is a `SampleReceiver` implementation that can demodulate FM, AM, SSB, and CW signals, and play them on the speakers or headphones using the Web Audio API.

### Modes

The `Demodulator` uses `Mode` objects, which contain the parameters that define a modulation scheme. You can use the following functions to create and modify `Mode` objects:

```typescript
import {
  getMode,
  getSchemes,
  modeParameters,
} from "@jtarrio/webrtlsdr/demod/modes";
```

The `getMode()` function returns a `Mode` object with the default parameters for a given modulation scheme name.

```typescript
let mode = getMode("WBFM");
```

The `getSchemes()` function returns the names of all known modulation schemes.

```typescript
let modes = {};
for (let name of getSchemes()) {
  modes[name] = getMode(name);
}
```

The `modeParameters()` function provides a uniform mechanism to get and set the parameters of a `Mode` object. The properties of a `Mode` object are different depending on its scheme, so you would need to write different code to modify different modes; with the `modeParameters()` function you can use the same code to modify the parameters for any known mode.

The `modeParameters()` function takes a mode or a scheme name and returns an object with three methods for each parameter:

- a `hasXxx()` method that returns whether this parameter is available for this mode,
- a `getXxx()` method that returns the value of the parameter for the mode (or a dummy value for modes that don't support the parameter), and
- a `setXxx()` method that sets the value of the parameter in the mode (or does nothing for modes that don't support the parameter).

The parameters are:

- Bandwidth (`hasBandwidth()`/`getBandwidth()`/`setBandwidth()`): corresponds to the bandwidth in AM, SSB, and CW, and to double the maximum deviation in NBFM. Not adjustable in WBFM, where it always has the value `150000`.
- Stereo (`hasStereo()`/`getStereo()`/`setStereo()`): whether stereo is enabled. Only available in WBFM; in other modes, it always is `false`.
- Squelch (`hasSquelch()`/`getSquelch()`/`setSquelch()`): the squelch level. Not available in WBFM and CW, where it always has value `0`.

The modified mode is available as the `mode` property.

```typescript
let params = modeParameters(mode);
if (!params.hasBandwidth()) console.log("Bandwidth will not be changed");
console.log("Old value:", params.getBandwidth());
params.setBandwidth(10000);
console.log("New value:", params.getBandwidth());
let newMode = params.mode;
```

### Create the demodulator

```typescript
import { Demodulator } from "@jtarrio/webrtlsdr/demod/demodulator";
```

The `Demodulator`'s constructor doesn't take any arguments.

#### Example

```typescript
let demodulator = new Demodulator();
let radio = new Radio(new RTL2832U_Provider(), demodulator);
```

### Set the parameters

The `Demodulator` object has multiple methods that let you change its parameters and also see their current values. You can call those methods whether the radio is currently playing or not.

#### Mode

The "mode" consists of all the parameters that define the modulation schema used by the transmitter. These parameters are stored in a `Mode` object.

You can set the mode with the `setMode()` method.

```typescript
demodulator.setMode(mode);
```

You can get the current mode with the `getMode()` method.

```typescript
let mode = demodulator.getMode();
```

By default, the demodulator uses WBFM with its default parameters.

A common idiom to modify a parameter of the current mode is:

```typescript
let params = modeParameters(demodulator.getMode());
params.setBandwidth(newBandwidth);
demodulator.setMode(params.mode);
```

#### Frequency offset

The radio captures a large bandwidth, and signals may be available in any place within this bandwidth. You can tune into any particular frequency within the received bandwidth by changing the "frequency offset". An offset of `0` represents the radio's center frequency; positive and negative offsets are added and subtracted from the center frequency.

For example, if you are tuned on 90.5 MHz and want to demodulate a signal on 90.4 MHz, you would apply an offset of `-100000`.

You can set the frequency offset with the `setFrequencyOffset()` method.

```typescript
demodulator.setFrequencyOffset(offset);
```

You can get the current offset with the `getFrequencyOffset()` method.

```typescript
let offset = demodulator.getFrequencyOffset();
```

By default, the modulator uses a `0` frequency offset.

Frequency, you will want to change your radio's center frequency and offset at the same time. To achieve this without creating audible glitches, you can use the `expectFrequencyAndSetOffset()` method. After you call this method with a given center frequency, the demodulator will wait to receive samples belonging to that frequency and then it will change the offset to the given value.

```typescript
let newCenterFrequency = 88.5 * 1e6;
let newOffsetFrequency = -100000;
demodulator.expectFrequencyAndSetOffset(newCenterFrequency, newOffsetFrequency);
radio.setFrequency(newCenterFrequency);
```

#### Volume

You can change the volume of the demodulated audio with the `setVolume()` method. The argument is a value from 0 (silent) to 1 (full volume).

```typescript
demodulator.setVolume(volume);
```

You can get the current volume with the `getVolume()` method.

```typescript
let volume = demodulator.getVolume();
```

By default, the volume is `0`.

## Example

For an example that uses many of the functions, classes, and methods described above, check [`examples/highlevel`](../examples/highlevel/).

## Extra goodies

The high-level API has some additional functionalities that can help you build your radio application.

### Use several sample receivers at once

Sometimes, you may want the `Radio` to send samples to more than one `SampleReceiver`. For example, the [`Radio Receiver`](https://github.com/jtarrio/radioreceiver) application demodulates the radio signals with the `Demodulator` at the same time that it computes their frequency spectrum using another `SampleReceiver`.

The application achieves this with a `CompositeReceiver`. Every time one of the methods of the `CompositeReceiver` object is called, it will call the same method in every component receiver.

```typescript
import { CompositeReceiver } from "@jtarrio/webrtlsdr/radio";

let demodulator = new Demodulator();
let spectrum = new Spectrum();
let otherReceiver = new MySampleReceiver();
let radio = new Radio(
  new RTL2832U_Provider(),
  CompositeReceiver.of(demodulator, spectrum, otherReceiver)
);
```

### Trigger periodic events

Use the `SampleCounter` to dispatch an event several times per second. This class is a `SampleReceiver` that counts the number of received samples and triggers an event when appropriate.

The class constructor takes the number of events per second that should be triggered, and you can listen on its `sample-click` event.

```typescript
// Trigger the event 20 times per second
let sampleCounter = new SampleCounter(20);
let radio = new Radio(new RTL2832U_Provider(), sampleCounter);
sampleCounter.addEventListener("sample-click", onSampleClick);

function onSampleClick() {
  console.log("Click!");
}
```

### Compute the frequency spectrum

You can use the `Spectrum` sample receiver to compute the frequency spectrum of your received radio signals.

It receives the sample stream and you can call its `getSpectrum()` method periodically to get the spectrum of the latest samples (you can use `SampleCounter` for this.)

The `Spectrum` class has a `size` property that contains the number of frequency buckets in the spectrum. This size is always a power of 2. You can set it to another value if you wish — if you don't specify a power of 2, it will be set to the next higher power of 2.

This class also has a `getSpectrum()` method. This method takes a `Float32Array` that will be populated with the content of the spectrum of the last few received samples. This array should be of the same size returned by the `size` property, but it is not an error if it isn't: only the elements that fit in the array will be populated.

Each element of the populated array contains the power for that frequency bin in decibels (dB). The first half of the elements contains the positive frequency bins, and the second half contains the negative frequency bins.

```typescript
import { Spectrum } from "@jtarrio/webrtlsdr/demod/spectrum";

let demodulator = new Demodulator();
let spectrum = new Spectrum();
let sampleCounter = new SampleCounter(20);
let radio = new Radio(
  new RTL2832U_Provider(),
  CompositeReceiver.of(spectrum, demodulator, sampleCounter)
);

sampleCounter.addEventListener("sample-click", onSampleClick);
let spec = new Float32Array(spectrum.size);
function onSampleClick() {
  spectrum.getSpectrum(spec);
  /* do something with the spectrum */
}
```
