# Web RTL-SDR High-level API

The high-level API lets you operate a multimode radio receiver in not many lines of code.

This API provides a [`Radio`](../src/radio/radio.ts) class, which receives commands from your program, controls the RTL-SDR device, and generates a stream of samples; and a [`SampleReceiver`](../src/radio/sample_receiver.ts) interface, which receives the sample stream and operates on it.

The API also provides a [`Demodulator`](../src/demod/demodulator.ts), which is a [`SampleReceiver`](../src/radio/sample_receiver.ts) that can demodulate FM, AM, SSB, and CW signals and play them on the speakers or headphones using the Web Audio API.

## The `Radio` class

### Imports

To use the high-level [`Radio`](../src/radio/radio.ts) API, import the following modules:

```typescript
import { Radio } from "@jtarrio/webrtlsdr/radio.js";
import { RTL2832U_Provider } from "@jtarrio/webrtlsdr/rtlsdr.js";
```

### Create a `Radio`

The constructor for the [`Radio`](../src/radio/radio.ts) class takes two arguments: an [`RtlDeviceProvider`](../src/rtlsdr/rtldevice.ts) that returns the RTL-SDR device to use, and a [`SampleReceiver`](../src/radio/sample_receiver.ts) that will get the sample stream.

#### Example

We need a [`SampleReceiver`](../src/radio/sample_receiver.ts) object to create the [`Radio`](../src/radio/radio.ts), so for this example, we'll create one that logs the number of samples that were received in each block. (There will be a full explanation of the [`SampleReceiver`](../src/radio/sample_receiver.ts) interface later.)

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

Use the [`Radio`](../src/radio/radio.ts) object's `start()` and `stop()` methods to start and stop the radio, respectively.

Use the `isPlaying()` method to get the current state.

Note that the `start()` and `stop()` methods may return before the radio is started or stopped. Therefore, if you call `isPlaying()` right after `start()` or `stop()`, you will get the "wrong" result.

You can get notifications when the radio starts and stops playing; to do that, listen for the [`Radio`](../src/radio/radio.ts) event.

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

### Events

The [`Radio`](../src/radio/radio.ts) class can dispatch `radio` events. Those events have a `detail` property that contains an object with a property named `type`, which can have one of the following values:

- `starting`: dispatched when the radio starts playing;
- `stopping`: dispatched when the radio stops playing;
- `directSampling`: dispatched when the radio enters or leaves direct sampling mode. The `active` property contains whether direct sampling mode is active;
- `error`: dispatched when the radio fails because of an error. The `exception` property contains the exception that caused the error, if any.

```typescript
radio.addEventListener("radio", onRadio);

function onRadio(e) {
  if (e.detail.type == "started") console.log("Radio started");
  if (e.detail.type == "stopped") console.log("Radio stopped");
  if (e.detail.type == "directSampling")
    console.log(
      e.detail.active ? "Radio is direct sampling" : "Radio is tuner sampling"
    );
  if (e.detail.type == "error")
    console.log("Radio returned an error:", e.detail.exception);
}
```

### Set the parameters

The [`Radio`](../src/radio/radio.ts) object has multiple methods that let you change the radio parameters and also see their current values. You can call those methods whether the radio is currently playing or not.

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

RTL-SDR devices use a crystal oscillator to generate their internal reference signals. Due to manufacturing tolerances and other considerations, most oscillators run at a slightly different frequency than nominal, which makes RTL-SDR devices tune a little off-frequency.

You can set a "frequency correction factor" that makes the radio tune slightly up or down to compensate for the inaccuracy in its crystal. This factor is expressed in "parts per million," and you can set it with the `setFrequencyCorrection()` method.

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

Most RTL-SDR devices can only receive signals from 29 MHz to 1700 MHz. Some devices, however, have a modification that allows "direct sampling." In direct sampling mode, the tuner circuit is bypassed, and the digitizer receives the signals directly; this lets the device receive signals below 29 MHz. Depending on how the modification was made, the bypassed signals are received through the `I` channel or the `Q` channel.

If you want to use direct sampling, you only need to specify the method. You don't need to enable or disable it depending on the frequency; Web RTL-SDR will activate it automatically for frequencies below 29 MHz only. When the radio starts or stops using direct sampling, it will send a `radio` event with `directSampling` type.

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

Some RTL-SDR devices have a special circuit, called a "bias T," that can provide power to an external device through the antenna connector.

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

When the [`Radio`](../src/radio/radio.ts) is playing, it receives a stream of samples from an RTL-SDR device and provides it to a [`SampleReceiver`](../src/radio/sample_receiver.ts) object by calling its `receiveSamples()` method repeatedly.

You can create your own [`SampleReceiver`](../src/radio/sample_receiver.ts) object by implementing this interface.

### Imports

You don't need to import anything if you use JavaScript. If you use TypeScript, you should import the [`SampleReceiver`](../src/radio/sample_receiver.ts) type:

```typescript
import { SampleReceiver } from "@jtarrio/webrtlsdr/radio.js";
```

### Method `setSampleRate()`

The `setSampleRate()` method is called by the [`Radio`](../src/radio/radio.ts) object whenever a stream starts or the radio's sample rate is changed. It takes a single parameter:

- `sampleRate` (`number`): the new sample rate as the number of samples per second.

### Method `receiveSamples()`

The `receiveSamples()` method is called by the [`Radio`](../src/radio/radio.ts) object whenever there is a new block of samples. It takes three parameters:

- `I` (`Float32Array`): the successive values of the samples' I components.
- `Q` (`Float32Array`): the successive values of the samples' Q components.
- `frequency` (`number`): the frequency that the RTL-SDR device was tuned to when it received this block of samples.

The `I` and `Q` arrays have the same number of elements, and each element of `I`, together with the element of `Q` with the same index, forms one I/Q sample.

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
    let dB = 10 * Math.log10(power / I.length);
    console.log("Power:", dB);
  }
}
```

## The `Demodulator` class

Web RTL-SDR provides a [`Demodulator`](../src/demod/empty-demodulator.ts) class, which is a [`SampleReceiver`](../src/radio/sample_receiver.ts) implementation that can demodulate FM, AM, SSB, and CW signals. By default, it will play the demodulated audio on the speakers or headphones using the Web Audio API, but if you want to do something else (for example, record it in a file or send it over the network), you can provide your own code to do that.

### Modes

The [`Demodulator`](../src/demod/empty-demodulator.ts) supports multiple modulation schemes that are defined using [`Mode`](../src/demod/modes.ts) objects. You can use the following functions to create and modify [`Mode`](../src/demod/modes.ts) objects:

```typescript
import {
  getMode,
  getSchemes,
  modeParameters,
} from "@jtarrio/webrtlsdr/demod/modes.js";
```

The `getSchemes()` function returns the names of all available modulation schemes (WBFM, NBFM, AM, USB, LSB, and CW).

The `getMode()` function returns a [`Mode`](../src/demod/modes.ts) object with the default parameters for a given modulation scheme name.

```typescript
let modes = {};
for (let name of getSchemes()) {
  modes[name] = getMode(name);
}
```

The properties of a [`Mode`](../src/demod/modes.ts) object vary depending on the modulation scheme, so to modify them, you would need to write different code for each mode. The `modeParameters()` function provides a uniform mechanism to get and set the parameters of a [`Mode`](../src/demod/modes.ts) object so that you can change them all using the same code.

The `modeParameters()` function takes a mode or a scheme name and returns an object with three methods for each parameter:

- a `hasXxx()` method that returns whether this parameter is available for this mode,
- a `getXxx()` method that returns the value of the parameter for the mode (or a dummy value for modes that don't support the parameter), and
- a `setXxx()` method that sets the value of the parameter in the mode (or does nothing for modes that don't support the parameter).

The parameters are:

- Bandwidth (`hasBandwidth()`/`getBandwidth()`/`setBandwidth()`):
  - for AM, SSB, and CW, it corresponds to the bandwidth;
  - for NBFM, it contains twice the maximum deviation (so, if the maximum deviation is 5 kHz, the bandwidth appears as 10 kHz);
  - not available for WBFM, where it always appears as the value `150000`.
- Stereo (`hasStereo()`/`getStereo()`/`setStereo()`)
  - for WBFM, whether stereo decoding is enabled;
  - not available for other modes, where it always appears as the `false` value.
- Squelch (`hasSquelch()`/`getSquelch()`/`setSquelch()`)
  - for NBFM, AM, and SSB, the squelch level;
  - not available for WBFM and CW, where it always appears as the value `0`.

You can retrieve the mode with the altered parameters by accessing the `mode` property.

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
import { Demodulator } from "@jtarrio/webrtlsdr/demod/demodulator.js";
```

The [`Demodulator`](../src/demod/empty-demodulator.ts)'s constructor doesn't take any arguments.

#### Example

```typescript
let demodulator = new Demodulator();
let radio = new Radio(new RTL2832U_Provider(), demodulator);
```

### Events

The [`Demodulator`](../src/demod/empty-demodulator.ts) class can dispatch `stereo-status` events. Those events have a `detail` property that contains a boolean value that indicates if the current signal is in stereo or not. This event is dispatched whenever the signal switches from stereo to mono, or vice versa.

```typescript
demodulator.addEventListener("stereo-status", onStereoStatus);

function onStereoStatus(e) {
  if (e.detail) {
    console.log("The signal is now stereo");
  } else {
    console.log("The signal is now mono");
  }
}
```

### Set the parameters

The [`Demodulator`](../src/demod/empty-demodulator.ts) object has multiple methods that let you change its parameters and also see their current values. You can call those methods whether the radio is currently playing or not.

#### Mode

You can set the mode used by the demodulator with the `setMode()` method.

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

The radio captures a large bandwidth, and signals may be available in any place within this bandwidth. You can tune into any particular frequency within the received bandwidth by changing the "frequency offset." An offset of `0` represents the radio's center frequency; positive and negative offsets are added and subtracted from the center frequency.

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

You will frequently want to change your radio's center frequency and offset at the same time. You could try to do this by calling the `Radio.setFrequency()` and `Demodulator.setFrequencyOffset()` methods sequentially, but this will almost always produce audible glitches. To avoid this, call the `Demodulator.expectFrequencyAndSetOffset()` method first, and then call `Radio.setFrequency()`.

The `expectFrequencyAndSetOffset()` method takes two arguments: the new center frequency and the new frequency offset. After calling this function, the demodulator will wait to receive samples belonging to the new center frequency; as soon as they arrive, it will change the offset frequency to the new value.

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

### Use a different output for the demodulator

By default, the demodulator sends the demodulated audio to an [`AudioPlayer`](../src/players/audioplayer.ts) class, which will play this audio on your speakers or headphones. If you want to do something different with the audio, you can provide options to the [`AudioPlayer`](../src/players/audioplayer.ts) to modify its behavior, or you can provide your own implementation of the [`Player`](../src/demod/player.ts) interface and pass it in the options for the [`Demodulator`](../src/demod/empty-demodulator.ts) constructor.

#### Options for `AudioPlayer`

The [`AudioPlayer`](../src/players/audioplayer.ts) class receives an optional `options` argument, which may contain the following fields:

- `newAudioContext`: a function that returns an `AudioContext`.

#### Implementing the `Player` interface

The [`Player`](../src/demod/player.ts) interface has one property, `sampleRate`, which contains the sample rate that the class expects to receive in its `play()` method.

It also has three methods:

- the `play()` method takes two arguments of type `Float32Array`: one with the samples for the left speaker and another for the right speaker;
- the `setVolume()` method takes a `number` from 0 to 1 and sets the output volume to that value, where 0 is silent and 1 is full volume;
- the `getVolume()` method returns the currently set volume.

#### Example

```typescript
/** This Player sends the audio signals to another server. */
class NetworkPlayer {
  constructor(url) {
    this.url = url;
    this.volume = 0;
    this.sequence = 0;
  }

  get sampleRate() {
    return 48000;
  }

  play(left, right) {
    fetch(url, {
      method: "POST",
      body: JSON.stringify({
        sequence: this.sequence,
        left: [...left],
        right: [...right],
        volume: this.volume,
      }),
    });
    this.sequence += left.length;
  }

  setVolume(volume) {
    this.volume = volume;
  }

  getVolume() {
    return this.volume;
  }
}

let demodulator = new Demodulator(new NetworkPlayer(REMOTE_URL));
let radio = new Radio(new RTL2832U_Provider(), demodulator);
```

## Extra goodies

The high-level API has some additional functionalities that can help you build your radio application.

### Use several sample receivers at once

Sometimes you may want the [`Radio`](../src/radio/radio.ts) to send samples to more than one [`SampleReceiver`](../src/radio/sample_receiver.ts). For example, the [`Radio Receiver`](https://github.com/jtarrio/radioreceiver) application demodulates the radio signals with the [`Demodulator`](../src/demod/empty-demodulator.ts) at the same time that it computes their frequency spectrum using another [`SampleReceiver`](../src/radio/sample_receiver.ts).

The application achieves this with a [`CompositeReceiver`](../src/radio/sample_receiver.ts). Every time one of the methods of the [`CompositeReceiver`](../src/radio/sample_receiver.ts) object is called, it will call the same method in every component receiver.

```typescript
import { CompositeReceiver } from "@jtarrio/webrtlsdr/radio.js";

let demodulator = new Demodulator();
let spectrum = new Spectrum();
let otherReceiver = new MySampleReceiver();
let radio = new Radio(
  new RTL2832U_Provider(),
  CompositeReceiver.of(demodulator, spectrum, otherReceiver)
);
```

### Trigger periodic events

Use the [`SampleCounter`](../src/radio/sample-counter.ts) to dispatch an event several times per second. This class is a [`SampleReceiver`](../src/radio/sample_receiver.ts) that counts the number of received samples and triggers an event when appropriate.

The class constructor takes the number of events per second that should be triggered, and you can listen for its `sample-click` event.

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

You can use the [`Spectrum`](../src/radio/spectrum.ts) sample receiver to compute the frequency spectrum of your received radio signals. You can call its `getSpectrum()` method periodically to get the spectrum of the received signals so you can display it on a waterfall, for example. (You can use [`SampleCounter`](../src/radio/sample-counter.ts) to perform the periodic calls.)

The [`Spectrum`](../src/radio/spectrum.ts) class has a `size` property that contains the number of frequency buckets in the spectrum. This size is always a power of 2. You can set it to another value if you wish; if you don't specify a power of 2, it will be set to the next higher power of 2.

This class also has a `getSpectrum()` method that takes a `Float32Array` that will be populated with the content of the spectrum of the last few received samples. This array should be of the same size returned by the `size` property, but it is not an error if it isn't: only the elements that fit in the array will be populated.

Each element of the populated array contains the power for that frequency bin in decibels (dB). The first half of the elements contains the positive frequency bins, and the second half contains the negative frequency bins.

```typescript
import { Spectrum } from "@jtarrio/webrtlsdr/demod/spectrum.js";

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

## Example

For an example that uses many of the functions, classes, and methods described above, check [`examples/highlevel`](../examples/highlevel/).
