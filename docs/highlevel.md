# Web RTL-SDR High-level API

You can use the [Signals library](https://github.com/jtarrio/signals) for a high-level API that lets you operate a multimode radio receiver in not many lines of code.

Web RTL-SDR provides a [`RtlSource`](../src/radio/source.ts) class that receives samples from an RTL-SDR stick, a [`RtlProvider`](../src/radio/source.ts) class that returns a `RtlSource`, and it also extends the [`Radio`](../src/radio/radio.ts) class to provide RTL-SDR specific methods.

This document explains the basics of using the high-level API, focusing on the new parts introduced by Web RTL-SDR. For more details, consult the [Signals library documentation](https://github.com/jtarrio/signals/tree/main/docs).

## Installing dependencies

You will need to install the `@jtarrio/signals` package:

```shell
npm install @jtarrio/signals
```

## Creating a `Radio`

This is how you create an instance of [`Radio`](../src/radio/radio.ts) that reads from an RTL-SDR stick and plays the demodulated sound to the computer's speaker.

```typescript
import { Radio, RtlProvider } from "@jtarrio/webrtlsdr/radio.js";
import { Demodulator } from "@jtarrio/signals/demod/demodulator.js";

let radio = new Radio(new RtlProvider(), new Demodulator());
```

The `Radio` class has the following methods:

- `start()`: start reading from the stick and playing the demodulated signals. This method returns a promise that resolves when the radio is playing.
- `stop()`: stop reading from the stick. This method returns a promise that resolves when the radio is not playing.
- `isPlaying()`: returns whether the radio is playing.
- `setSampleRate()`/`getSampleRate()`: sets and returns the radio's sample rate. The change only takes effect when the radio starts playing.
- `setFrequency()`/`getFrequency()`: sets and returns the radio's tuned frequency.
- `setGain()`/`getGain()`: sets and returns the radio's current gain.
- `setFrequencyCorrection()`/`getFrequencyCorrection()`: sets and returns the current frequency correction factor, in parts-per-million (PPM).
- `setDirectSamplingMethod()`/`getDirectSamplingMethod()`: sets and returns the current direct sampling method .
- `enableBiasTee()`/`isBiasTeeEnabled()`: enables or disables the bias T.

The `start()`, `stop()`, `enableBiasTee()`, and all the `setXxx()` methods return a promise. For `setSampleRate()`, the promise resolves immediately; for every other method, the promise resolves after the change takes effect.

```typescript
// Set automatic gain
await radio.setGain(null);

// Tune into 93.9 MHz
await radio.setFrequency(93.9e6);

// Start the radio
await radio.start();

// Stop the radio after 5 seconds
setTimeout(() => radio.stop(), 5000);
```

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

## Web RTL-SDR specifics

### The `RtlProvider` class

The [`RtlProvider](../src/radio/source.ts) class implements the [Signals library's `SignalSourceProvider` class](https://github.com/jtarrio/signals/blob/main/src/radio/signal_source.ts) and returns an [`RtlSource`](../src/radio/source.ts) instance that can receive samples from an RTL-SDR device.

The [`RtlProvider](../src/radio/source.ts) class uses an [`RtlDeviceProvider`](../src/rtlsdr/rtldevice.ts) to obtain an [`RtlDevice`](../src/rtlsdr/rtldevice.ts) instance, and then uses that to build the [`RtlSource`](../src/radio/source.ts). By default, it uses [`RTL2832U_Provider`](../src/rtlsdr/rtl2832u.ts) as its provider, but you can pass a different provider instance in the [`RtlProvider](../src/radio/source.ts) constructor.

### The `RtlSource` class

The an [`RtlSource`](../src/radio/source.ts) class implements the [Signals library's `SignalSource` class](https://github.com/jtarrio/signals/blob/main/src/radio/signal_source.ts) and uses an [`RtlDevice`](../src/rtlsdr/rtldevice.ts) instance to talk to an RTL-SDR device.

You don't normally create [`RtlSource`](../src/radio/source.ts) instances directly, but you get them from a properly configured [`RtlProvider](../src/radio/source.ts).

```typescript
// Obtains an RtlSource using the default provider.
let provider = new RtlProvider();
let source = provider.get();

// Uses a custom RtlDeviceProvider for the source.
provider = new RtlProvider(new CustomRtlDeviceProvider());
source = provider.get();
```

[`RtlSource`](../src/radio/source.ts) instances have four parameters that you can set with the `setParameter()` function:

- `"gain"`: the tuner gain in dB, or `null` for automatic gain.
- `"frequency_correction"`: the frequency correction factor, in parts-per-million (PPM).
- `"direct_sampling_method"`: the RTL-SDR device's direct sampling method.
- `"bias_tee"`: enable or disable the bias T.

### The `Radio` class

The [`Radio`](../src/radio/radio.ts) class extends the [Signals library's `Radio` class](https://github.com/jtarrio/signals/blob/main/src/radio/radio.ts). It adds methods to set and query the four parameters in the [`RtlSource`](../src/radio/source.ts) class:

- `setGain()`/`getGain()`: sets and returns the radio's current gain using the `"gain"` parameter.
- `setFrequencyCorrection()`/`getFrequencyCorrection()`: sets and returns the current frequency correction factor, in parts-per-million (PPM), using the `"frequency_correction"` parameter.
- `setDirectSamplingMethod()`/`getDirectSamplingMethod()`: sets and returns the current direct sampling method using the `"direct_sampling_method"` parameter.
- `enableBiasTee()`/`isBiasTeeEnabled()`: enables or disables the bias T using the `"bias_tee"` parameter.

### Descriptions of the parameters

#### Tuner gain

The tuner in the RTL-SDR device has an amplifier circuit to boost the power of the received signals. You can set the gain of this amplification circuit manually, or you can enable "automatic gain control" to let the RTL-SDR device adjust the gain by itself.

You can configure the gain with the `"gain"` parameter in the [`RtlSource`](../src/radio/source.ts) class and the `setGain()` method in the [`Radio`](../src/radio/radio.ts) class. Give it a `null` value to enable automatic gain control, or a number to set the gain to that approximate amount in decibels (dB):

```typescript
await radio.setGain(autoGain ? null : gain);
```

By default, the [`Radio`](../src/radio/radio.ts) class configures the source to use automatic gain control.

#### Frequency correction factor

RTL-SDR devices use a crystal oscillator to generate their internal reference signals. Due to manufacturing tolerances and other considerations, most oscillators run at a slightly different frequency than nominal, which makes RTL-SDR devices tune a little off-frequency.

You can set a "frequency correction factor" that makes the radio tune slightly up or down to compensate for the inaccuracy in its crystal. This factor is expressed in "parts per million," and you can set it with the `"frequency_correction"` parameter in the [`RtlSource`](../src/radio/source.ts) class and the `setFrequencyCorrection()` method in the [`Radio`](../src/radio/radio.ts) class.

```typescript
await radio.setFrequencyCorrection(ppm);
```

By default, the [`Radio`](../src/radio/radio.ts) class configures the source to use a 0 PPM correction factor.

#### Direct sampling

Most RTL-SDR devices can only receive signals from 29 MHz to 1700 MHz. Some devices, however, have a modification that allows "direct sampling." In direct sampling mode, the tuner circuit is bypassed, and the digitizer receives the signals directly; this lets the device receive signals below 29 MHz. Depending on how the modification was made, the bypassed signals are received through the `I` channel or the `Q` channel.

If you want to use direct sampling, you only need to specify the method. You don't need to enable or disable it depending on the frequency; Web RTL-SDR will activate it automatically for frequencies below 29 MHz only. When the radio starts or stops using direct sampling, it will send a `radio` event with `directSampling` type.

You can enable direct sampling mode and specify the channel through the `"direct_sampling_method"` parameter in the [`RtlSource`](../src/radio/source.ts) class and the `setDirectSamplingMethod()` method in the [`Radio`](../src/radio/radio.ts) class.

```typescript
// Disable direct sampling
await radio.setDirectSamplingMethod(DirectSampling.Off);
// Enable direct sampling on the Q channel
await radio.setDirectSamplingMethod(DirectSampling.Q);
// Enable direct sampling on the I channel
await radio.setDirectSamplingMethod(DirectSampling.I);
```

By default, the [`Radio`](../src/radio/radio.ts) class configures the source to disable direct sampling.

#### Bias T

Some RTL-SDR devices have a special circuit, called a "bias T," that can provide power to an external device through the antenna connector.

You can turn the bias T on and off through the `"bias_tee"` parameter in the [`RtlSource`](../src/radio/source.ts) class and the `enableBiasTee()` method in the [`Radio`](../src/radio/radio.ts) class.

```typescript
await radio.enableBiasTee(biasTeeEnabled);
```

By default, the [`Radio`](../src/radio/radio.ts) class configures the source to turn the bias T off.
