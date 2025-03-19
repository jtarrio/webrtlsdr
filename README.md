# Web RTL-SDR

Access RTL-SDR devices and receive and demodulate radio signals from your web application.

## What is this

This is a library that provides functions to access and operate an RTL-SDR device from a web application, receive radio signals, demodulate them, and play it through the computer's speakers or headphones.

It provides access at several levels, from low-level operations on the RTL-SDR stick itself, to a full reception/demodulation pipeline.

This library powers Radio Receiver, my browser-based SDR application, which you can try at [radio.ea1iti.es](https://radio.ea1iti.es).

## Compatible hardware and software

Web RTL-SDR was written to work with an RTL-2832U-based DVB-T (European digital TV) USB receiver, with a R820/828/860 tuner chip. Support for other chips may be added as required.

## How to install

```shell
npm install @jtarrio/webrtlsdr
```

## How to use

I want to write a comprehensive set of documentation, but in the meantime, here is an introduction.

> [!NOTE]
> This library uses the WebUSB API to access the RTL-SDR device. This means that you need to do two things for it to work:
>
> - You must connect to the RTL-SDR device in response to a user gesture (a click or tap, generally.) You cannot, for example, connect to it automatically on opening a webpage or after a timeout.
> - Your web page must be served through a secure context. That means a HTTPS connection or a connection to `localhost`.

### High-level access to RTL-SDR (demodulate and play through the computer's speakers)

```typescript
import { Demodulator } from "@jtarrio/webrtlsdr/demod/demodulator";
import { getMode } from "@jtarrio/webrtlsdr/demod/scheme";
import { Radio } from "@jtarrio/webrtlsdr/radio/radio";
import { RTL2832U_Provider } from "@jtarrio/webrtlsdr/rtlsdr/rtl2832u";

const sampleRate = 1024000;
let demodulator = new Demodulator(sampleRate);
let radio = new Radio(new RTL2832U_Provider(), spectrum, sampleRate);

radio.setFrequency(88500000);
demodulator.setVolume(1);
demodulator.setMode(getMode("WBFM"));

getElementById("playButton").addEventListener("click", () => radio.start());
getElementById("stopButton").addEventListener("click", () => radio.stop());
```

### Low-level access (read samples straight from the stick)

```typescript
let provider = new RTL2832U_Provider();
let device = await provider.get();
await device.setSampleRate(1024000);
await device.setCenterFrequency(88500000);
await device.setGain(null);
await device.resetBuffer();
let samples = await device.readSamples(65536);
```

## Acknowledgements

This is a spinoff of https://github.com/jtarrio/radioreceiver, which is, in turn, a fork of https://github.com/google/radioreceiver. I am the original author, but I was employed by Google at the time.

Kudos and thanks to the [RTL-SDR project](http://sdr.osmocom.org/trac/wiki/rtl-sdr) for figuring out the magic numbers needed to drive the USB tuner.
