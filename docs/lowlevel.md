# Web RTL-SDR Low-level API

The low-level API lets you access the RTL-SDR stick directly to perform these operations, among others:

- change the sample rate;
- change the frequency;
- change the frequency correction factor (PPM);
- change the gain or enable/disable automatic gain control;
- enable/disable direct sampling mode;
- enable/disable the bias T, if equipped;
- read samples from the stick.

## Import the low-level API

To use the low-level API, import the `@jtarrio/webrtlsdr/rtlsdr` module:

```typescript
import { RTL2832U_Provider } from "@jtarrio/webrtlsdr/rtlsdr.js";
```

## Connect to the RTL-SDR stick

Call the `get()` method in the [`RTL2832U_Provider`](../src/rtlsdr/rtl2832u.ts) class to connect to the RTL-SDR device. This method returns a promise that resolves to an [`RtlDevice`](../src/rtlsdr/rtldevice.ts).

> [!NOTE]
> You can only connect to an RTL-SDR device in a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts). This means that your webpage must be served over HTTPS or hosted on `localhost`.
>
> You can only connect to an RTL-SDR device in response to a user interaction. This means that you cannot open the RTL-SDR device when the page is opened or automatically in other ways; the user must have clicked a button, pressed a key, or interacted with the webpage right before you try to connect to the RTL-SDR device.

When you call `get()`, the user sees a dialog box that asks which RTL-SDR device to connect to. Once the user confirms their choice, the promise returned by `get()` resolves to a [`RtlDevice`](../src/rtlsdr/rtldevice.ts) object that is connected to the RTL-SDR device. If the user cancels, the promise resolves to an exception.

You can close the connection to the RTL-SDR device by calling the [`RtlDevice`](../src/rtlsdr/rtldevice.ts) object's `close()` async method.

The [`RTL2832U_Provider`](../src/rtlsdr/rtl2832u.ts) class manages the USB connection. If you are going to open and close the RTL-SDR device multiple times, reuse the same [`RTL2832U_Provider`](../src/rtlsdr/rtl2832u.ts) object; otherwise, the user will get a confirmation dialog every time you try to open the RTL-SDR device.

### Example

The following example has a "Start" button with an `onclick` event listener that opens a connection to an RTL-SDR device. As soon as the connection is opened, the program closes it again; you can press "Start" to open the connection again.

```html
<!DOCTYPE html>
<html>
  <body>
    <button id="startButton">Start</button>
  </body>
</html>
```

```typescript
import { RTL2832U_Provider } from "@jtarrio/webrtlsdr/rtlsdr.js";

document.getElementById("startButton").addEventListener("click", onStartClick);

// Reuse the provider to avoid asking the user every time the connection is opened.
var provider;

async function onStartClick() {
  if (!provider) provider = new RTL2832U_Provider();
  let device = await provider.get();
  console.log("Connection opened");
  await device.close();
  console.log("Connection closed");
}
```

To see the effect of not reusing the [`RTL2832U_Provider`](../src/rtlsdr/rtl2832u.ts) object, remove the `if (!provider)` statement and then click the "Start" button multiple times. The program will ask for confirmation every time.

## Set the RTL-SDR stick parameters

The [`RtlDevice`](../src/rtlsdr/rtldevice.ts) object returned by [`RTL2832U_Provider`](../src/rtlsdr/rtl2832u.ts) has multiple methods that let you change the RTL-SDR device's parameters and also see their current values.

### Sample rate

The sample rate is the number of samples (I/Q value pairs) the device will capture per second. Most devices seem to work with sample rates between 960,000 and 2,880,000. Some devices can be set to 250,000 samples per second, but with strong aliasing problems.

Due to the Nyquist Theorem, the sample rate also determines the bandwidth of the signal the RTL-SDR device can capture at once: 1 sample per second corresponds to 1 Hertz of bandwidth. Therefore, if you want to increase the bandwidth, you also need to increase the sample rate; if you want to decrease the sample rate, you will also decrease the bandwidth.

You can change the sample rate with the `setSampleRate()` async method.

```typescript
let device = await provider.get();
await device.setSampleRate(1024000);
```

### Center frequency

You can change the frequency that the RTL-SDR device is tuned to. This frequency is the "center frequency" of the band of frequencies received by the device. For example, if you are receiving 1,500,000 samples per second and are tuned to a center frequency of 101 MHz, you will receive signals from 100.25 MHz to 101.75 MHz.

You can change the center frequency with the `setCenterFrequency()` async method.

```typescript
await device.setCenterFrequency(88.5 * 1e6);
```

You can check the current center frequency with the `getCenterFrequency()` method.

```typescript
console.log("Current frequency:", device.getCenterFrequency());
```

### Frequency correction factor

RTL-SDR devices use a crystal oscillator to generate their internal reference signals. Due to manufacturing tolerances and other considerations, most oscillators run at a slightly different frequency than nominal, which makes RTL-SDR devices tune a little off-frequency.

You can set a "frequency correction factor" that makes the RTL-SDR device tune slightly up or down to compensate for the inaccuracy in its crystal. This factor is expressed in "parts per million," and you can set it with the `setFrequencyCorrection()` async method.

```typescript
await device.setFrequencyCorrection(ppm);
```

You can also check the current frequency correction factor with the `getFrequencyCorrection()` method.

```typescript
console.log("Frequency correction PPM:", device.getFrequencyCorrection());
```

### Tuner gain

The tuner in the RTL-SDR device has an amplifier circuit to boost the power of the received signals. You can set the gain of this amplification circuit manually, or you can enable "automatic gain control" to let the RTL-SDR device adjust the gain by itself.

You can configure the gain with the `setGain()` async method. Give it a `null` value to enable automatic gain control, or a number to set the gain to that approximate amount in decibels (dB):

```typescript
if (autoGain) {
  await device.setGain(null);
} else {
  await device.setGain(gain);
}
```

You can get the current gain with the `getGain()` method, which returns a number or a `null` value.

```typescript
let gain = device.getGain();
console.log("Gain:", gain === null ? "auto" : gain);
```

### Direct sampling

Most RTL-SDR devices can only receive signals from 29 MHz to 1700 MHz. Some devices, however, have a modification that allows "direct sampling." In direct sampling mode, the tuner circuit is bypassed, and the digitizer receives the signals directly; this lets the device receive signals below 29 MHz. Depending on how the modification was made, the bypassed signals are received through the `I` channel or the `Q` channel.

If you want to use direct sampling, you only need to specify the method. You don't need to enable or disable it depending on the frequency; Web RTL-SDR will activate it automatically for frequencies below 29 MHz only.

You can enable direct sampling mode and specify the channel through the `setDirectSamplingMethod()` async method.

```typescript
// Disable direct sampling
await device.setDirectSamplingMethod(DirectSampling.Off);
// Enable direct sampling on the Q channel
await device.setDirectSamplingMethod(DirectSampling.Q);
// Enable direct sampling on the I channel
await device.setDirectSamplingMethod(DirectSampling.I);
```

You can also get the current direct sampling method with the `getDirectSamplingMethod()` method.

```typescript
console.log("Direct sampling:", device.getDirectSamplingMethod());
```

### Bias T

Some RTL-SDR devices have a special circuit, called a "bias T," that can provide power to an external device through the antenna connector.

You can turn the bias T on and off through the `enableBiasTee()` async method.

```typescript
await device.enableBiasTee(biasTeeEnabled);
```

You can get the current status of the bias T with the `isBiasTeeEnabled()` method.

```typescript
console.log("Bias T:", device.isBiasTeeEnabled());
```

## Receive samples from the RTL-SDR device

Before you start reading samples from the device, you need to reset its buffer by calling the `resetBuffer()` async method.

After resetting the buffer, call the `readSamples()` async method to get a block of samples. The argument to `readSamples()` is the number of samples to read, which should be a multiple of 512.

```typescript
await device.resetBuffer();
let samples = await device.readSamples(65536);
```

The `readSamples()` async method returns a `SampleBlock` object with three fields:

- `frequency`, which is the RTL-SDR device's center frequency when the samples were read;
- `data`, which contains an `ArrayBuffer` with the samples and is described below;
- `directSampling`, a boolean that indicates if direct sampling was active when the samples were read.

One sample consists of a pair of unsigned 8-bit values: the first value belongs to the `I` channel and the second value belongs to the `Q` channel.

You can convert the samples into two `Float32Array`s (one for the `I` channel and another for the `Q` channel) like this:

```typescript
let u8 = new Uint8Array(samples.data);
const len = u8.length / 2;
let I = new Float32Array(len);
let Q = new Float32Array(len);
for (let i = 0; i < len; ++i) {
  I[i] = (2 * u8[2 * i]) / 255 - 1;
  Q[i] = (2 * u8[2 * i + 1]) / 255 - 1;
}
```

### Read samples continuously

The previous section explains how to read a block of samples. If you want to read samples continuously, you still use the `readSamples()` async method, but in a different way: you should always have at least two calls to `readSamples()` in flight.

As you know, `readSamples()` is an async method. This means that, immediately after being called, it returns a `Promise` that will eventually resolve to a `SampleBlock` object.

If you call `readSamples()` twice, one of the methods will be reading from the device while the other waits for the first method to return. As soon as the first method fills its buffer, it will resolve its `Promise` and the second method will start reading from the device.

At this point, the promise should have a `then()` function that processes the content of the resolve `SampleBlock`. The first thing this function should do is call `readSamples()` again. This will ensure that there are always enough calls to `readSamples()` waiting to read from the RTL-SDR device.

This example shows one way to do this:

```typescript
// Set this to false when you want to stop reading from the RTL-SDR device.
let running = true;

// Start two readSamples() calls.
device.readSamples(65536).then(processSamples);
device.readSamples(65536).then(processSamples);

// This function is called as soon as one of the readSamples() methods returns.
function processSamples(samples) {
  // Stop if `running` is false.
  if (!running) return;
  // When we get there, one of the readSamples() calls just ended,
  // so start a new one to ensure there are always two in flight.
  device.readSamples(65536).then(processSamples);
  // Do something with the samples
  console.log("Sample block length:", samples.data.byteLength);
}
```

## Close the RTL-SDR device

Call the `close()` async method to stop the RTL-SDR device and release its resources.

```typescript
await device.close();
```

After calling `close()`, the variable holding the [`RtlDevice`](../src/rtlsdr/rtldevice.ts) is no longer valid, so you should discard it.

To reopen the device, call the `get()` method in the same [`RTL2832U_Provider`](../src/rtlsdr/rtl2832u.ts) object you used before. By reusing a provider, the method will return a connection to the same RTL-SDR device as before, and the user won't be asked to confirm. If you use a new provider, the user will be asked which RTL-SDR device to connect to.

## Example

For an example that uses many of the methods described above, check [`examples/lowlevel`](../examples/lowlevel/).
