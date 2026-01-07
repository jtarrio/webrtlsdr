# Migrating from Web RTL-SDR version 2 to version 3

## Low-level API

No changes.

## High-level API

Web RTL-SDR version 2 provides its own high-level library, but version 3 uses the Signals library. You will need to make changes in your program if you want to migrate from version 2 to version 3.

### New dependencies

You will need to install the `@jtarrio/signals` package to use the high-level API.

### Changed imports

The `@jtarrio/webrtlsdr/demod`, `@jtarrio/webrtlsdr/dsp`, and `@jtarrio/webrtlsdr/players` packages have been removed and replaced with `@jtarrio/signals/demod`, `@jtarrio/signals/dsp`, and `@jtarrio/signals/players`, respectively.

### Changes in packages

#### `@jtarrio/signals/dsp`
- Renamed:
  - The `U8Buffer`, `Float32Buffer`, and `IqBuffer` classes have been renamed to `U8Pool`, `Float32Pool`, and `IqPool`, respectively.
  - The `Deemphasizer` class has been renamed to `Deemphasis`, and the time constant argument is now expressed in seconds, not microseconds.
  - In all filters, the `delay()` method has been renamed to `getDelay()`.
- Removed:
  - The `ExpAverage` class has been removed. You should probably use `IIRLowPass` instead.
- Other changes:
  - The `FFT.transform()` and `FFT.reverse()` functions now return a 2-element array containing the I components and the Q components, instead of an object with a `real` field and an `imag` field.
  - The `SampleReceiver.receiveSamples()` function now takes a `SampleBlock` instance instead of separate `I`, `Q`, and `frequency` arguments.

#### `@jtarrio/webrtlsdr/radio`

- Moved:
  - `SampleBlock` has been moved to `@jtarrio/signals/radio/sample_block.js`, but it is still accessible through `@jtarrio/signals/radio.js`.
  - `CompositeReceiver` has been moved to `@jtarrio/signals/radio/sample_receiver.js`.
- Other changes:
  - The `Radio` constructor does no longer take a `RtlDeviceProvider` as its first argument, but a `RtlProvider`.
  - The `start()`, `stop()`, and `setXxx()` methods in `Radio` are now async and return a promise that resolves after the method has taken effect.
