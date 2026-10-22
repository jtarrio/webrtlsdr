# Change log

## 3.0.7

* `RtlSource`: Return parameter values from `setParameter()` so settings (such as gain) are not lost when modified while playing.
* `R828D`: Fixed an issue where the input path was not reconnected after exiting direct sampling mode.
* `RTL2832U`: Preserved manual gain when entering direct sampling mode, and reapplied sample rate when frequency correction (PPM) changes.
* Recover from stalls in USB control messages.
* Improved tuner PLL stability by setting crystal swing high, adding settling delays after power-on, and writing PLL registers in a single burst.
* Automatic retry on tuner PLL lock failure.
* `Radio`: Return the requested frequency and sample rate from setters.
* Fixed handling of the I2C repeater and ensured internal asynchronous operations are awaited.
* Improved documentation for RTL2832U and tuner registers.
* Updated `@jtarrio/signals` dependency to `0.10.2`.
* Thanks to [diddy](https://github.com/diddy-boy) for the notes!

## 3.0.6

* Updated `@jtarrio/signals` dependency to `0.10.0`.

## 3.0.5

* Exported provider options types from the public API.

## 3.0.4

* Added `FakeRtlDevice` and `FakeRtlProvider` for testing and development with a simulated RTL-SDR hardware device.

## 3.0.3

* Added configuration options for the `RTL2832U_Provider` constructor.

## 3.0.2

* Updated `@jtarrio/signals` dependency to `0.9.4`.

## 3.0.1

* Updated `@jtarrio/signals` dependency to `0.9.3` for faster stereo FM demodulation.

## 3.0.0

* Replaced internal DSP, demodulators, filters, FFT, and audio player with the `@jtarrio/signals` library.
* Removed `@jtarrio/webrtlsdr/demod`, `@jtarrio/webrtlsdr/dsp`, and `@jtarrio/webrtlsdr/players`.
* Refactored `Radio` to use `@jtarrio/signals` and `RtlProvider` implementing `SignalSourceProvider`.
* All `Radio` control methods (`start()`, `stop()`, `setFrequency()`, `setParameter()`) are now async and return promises.

## 2.0.5

* Added configuration options for demodulators.

## 2.0.4

* Added `buffersPerSecond` option to make the streaming buffer rate configurable.

## 2.0.3

* Exported files with and without file extensions for package imports.

## 2.0.2

* Added `.js` extensions to all imports and exports for standard ES module compatibility.

## 2.0.1

* Exported TypeScript types for demodulator and configuration constructors.
* Added documentation for Hilbert transform, delay filter, and AGC.

## 2.0.0

* Modulation schemes are now registered at runtime instead of statically configured.
* Split the WBFM demodulator into two distinct processing stages (FM demodulation and stereo audio decoding).
* Added comprehensive documentation for the DSP library and instructions for writing custom demodulators.

## 1.1.1

* Fixed FM demodulation.

## 1.1.0

* Added switchable audio output support (`AudioPlayer`), allowing audio output to be detached, switched, or disabled.
* Documented event types and audio configuration.

## 1.0.1

* Documentation updates and removed pre-1.0 notes.

## 1.0.0

* First stable release of Web RTL-SDR.
* Added high-level API documentation for `Radio` and demodulation.

## 0.1.0

* Exported `radio` and `rtlsdr` directly from the package root.
* Renamed `demod/schemes` to `demod/modes`.
* Added a class with property accessors instead of standalone functions.
* Added low-level API documentation.

## 0.0.3

* Documentation updates and clarifications for examples.

## 0.0.2

* Added usage examples for high-level and low-level APIs.
* Added repository link to `package.json`.

## 0.0.1

* First release, forked off `radioreceiver` as a standalone Web RTL-SDR library.
* Removed Chrome application UI, window management, presets, and settings.
* Exported core RTL-SDR WebUSB driver (`RtlDevice`, `RtlCom`, R820T and R828D tuner drivers) and DSP/demodulation pipeline.
* Replaced the custom multi-step build system with standard TypeScript compilation.
