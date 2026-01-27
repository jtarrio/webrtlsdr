# Using a simulated RTL-SDR stick

Suppose you want to work on your RTL-SDR application but you don't have a stick handy. You can use the [`FakeRtlDevice`](../src/fakertl/fakertl.ts) class to help you.

The [`FakeRtlDevice`](../src/fakertl/fakertl.ts) class simulates an RTL-SDR stick. You can use a function to generate a signal, and the [`FakeRtlDevice`](../src/fakertl/fakertl.ts) will make it available to your application.

## Example

Imagine you want to simulate an RTL-SDR device that receives the following signals:

- A WBFM station on 93.9 MHz broadcasting a stereo signal with a 600 Hz tone on the left and a 400 Hz tone on the right.
- An AM station on 810 kHz broadcasting a 900 Hz tone.
- A USB station on 14225 kHz broadcasting a 750 Hz tone.
- About -80dB of noise.

You start by creating your generator function. You can use the generators in [`@jtarrio/signals/sources/generators.js`](https://github.com/jtarrio/signals/blob/main/src/sources/generators.ts) to help you:

```typescript
import {
  modulateAM,
  modulateFM,
  noise,
  sum,
  tone,
  wbfmSignal,
} from "@jtarrio/signals/sources/generators.js";

let generator = sum(
  modulateFM(93.9e6, 75000, 0.1, wbfmSignal(tone(600, 0.5), tone(400, 0.5))),
  modulateAM(810e3, 0.1, tone(900, 0.5)),
  tone(14225750, 0.01),
  noise(0.03),
);
```

Then, you create an instance of [`FakeRtlDeviceProvider`](../src/fakertl/fakertl.ts) with the generator you just created.

```typescript
import { FakeRtlDeviceProvider } from "@jtarrio/webrtlsdr/fakertl/fakertl.js";

let rtlProvider = new FakeRtlDeviceProvider(generator);
```

Finally, you can use this provider to get a [`RtlDevice`](../src/rtlsdr/rtldevice.ts) instance that you can [use directly through the low-level API](lowlevel.md), or pass it to the [`Radio`](../src/radio/radio.ts) class constructor to [use it through the high-level API](highlevel.md).
