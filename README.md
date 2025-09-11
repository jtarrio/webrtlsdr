# Web RTL-SDR

Access RTL-SDR devices and receive and demodulate radio signals from your web application.

## What is this

This is a library that provides functions to access and operate an RTL-SDR device from a web application, receive radio signals, demodulate them, and play it through the computer's speakers or headphones.

It provides access at several levels, from low-level operations on the RTL-SDR stick itself to a full reception/demodulation pipeline.

This library powers Radio Receiver, my browser-based SDR application, which you can try at [radio.ea1iti.es](https://radio.ea1iti.es).

## Compatible hardware and software

Web RTL-SDR was written to work with an RTL-2832U-based DVB-T (European digital TV) USB receiver with a R820/828/860 tuner chip. Support for other chips may be added as required.

Web RTL-SDR uses the WebUSB API, which is only available in Chromium-based browsers (Chrome, Edge, Opera) on computers and Android devices.

## How to install

```shell
npm install @jtarrio/webrtlsdr
```

## How to use

See [the `docs` directory](docs/README.md) for the documentation, or check out the following examples.

### High-level access to RTL-SDR (demodulate and play through the computer's speakers)

This program is a complete stereo FM radio receiver tuned for 88.5 MHz.

```typescript
import { Demodulator } from "@jtarrio/webrtlsdr/demod/demodulator.js";
import { getMode } from "@jtarrio/webrtlsdr/demod/modes.js";
import { Radio } from "@jtarrio/webrtlsdr/radio.js";
import { RTL2832U_Provider } from "@jtarrio/webrtlsdr/rtlsdr.js";

let demodulator = new Demodulator();
let radio = new Radio(new RTL2832U_Provider(), demodulator);

radio.setFrequency(88500000);
demodulator.setVolume(1);
demodulator.setMode(getMode("WBFM"));

document
  .getElementById("playButton")
  .addEventListener("click", () => radio.start());
document
  .getElementById("stopButton")
  .addEventListener("click", () => radio.stop());
```

You can also see a full example at [`examples/highlevel`](examples/highlevel/script.js).

### Low-level access (read samples straight from the stick)

This program connects to the RTL-SDR stick, tunes to 88.5 MHz, reads 65536 samples, and closes the connection.

```typescript
import { RTL2832U_Provider } from "@jtarrio/webrtlsdr/rtlsdr.js";

let provider = new RTL2832U_Provider();
let device = await provider.get();
await device.setSampleRate(1024000);
await device.setCenterFrequency(88500000);
await device.setGain(null);
await device.resetBuffer();
let samples = await device.readSamples(65536);
await device.close();
```

You can also see a full example at [`examples/lowlevel`](examples/lowlevel/script.js).

## Acknowledgements

This is a spinoff of https://github.com/jtarrio/radioreceiver, which is, in turn, a fork of https://github.com/google/radioreceiver. (I am the original author, but I was employed by Google at the time.)

Kudos and thanks to the [RTL-SDR project](http://sdr.osmocom.org/trac/wiki/rtl-sdr) for figuring out the magic numbers needed to drive the USB tuner.
