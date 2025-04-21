# Web RTL-SDR's DSP library

If you want to implement your own demodulator, you can use Web RTL-SDR's built-in DSP library. Note that it is quite specialized to Web RTL-SDR's needs, so you may need to write your own DSP functions or use a third-party library.

The DSP library operates on blocks of samples stored in `Float32Array`s with values normally ranging between -1 and 1.

Some functions produce blocks of I/Q samples; those are stored in an array of two `Float32Array`s, with the first element holding the "I" components of the samples and the second element holding their corresponding "Q" components.

## Buffers

### Buffer pools to avoid allocations whenever possible

The DSP library tries very hard to avoid allocating memory while it's processing data, but sometimes it's unavoidable — for example, if you modify the size of a filter or an FFT window at runtime, you may need to change the size of other memory buffers.

In the [`dsp/buffers.ts`](../src/dsp/buffers.ts) file, the `Float32Buffer` and `U8Buffer` classes provide pools of preallocated buffers of different types. You can request a buffer of a particular size, and the class will give you one from the pool if it has the correct size. If not, the class will allocate a buffer of the correct size, add it to the pool, and return it.

```typescript
import { Float32Buffer, U8Buffer } from "@jtarrio/webrtlsdr/dsp/buffers";

// Creates a pool of 3 Float32Arrays of 1024 elements.
let f32buffer = new Float32Buffer(3, 1024);
let f1 = f32buffer.get(1024); // Returns a preallocated 1024-element Float32Array from the buffer
let f2 = f32buffer.get(1024); // Returns another preallocated Float32Array
let f3 = f32buffer.get(1024); // Returns another preallocated Float32Array
let f4 = f32buffer.get(1024); // Returns the same Float32Array as f1

let f5 = f32buffer.get(2048); // Allocates a 2048-element array and stores it in the pool, replacing one of the arrays
let f6 = f32buffer.get(2048); // Allocates another array and replaces another array in the pool
let f7 = f32buffer.get(2048); // Allocates another array and replaces another array in the pool
let f8 = f32buffer.get(2048); // Returns the same Float32Array as f5

// Creates a pool of 2 Uint8Arrays of length 0.
let u8buffer = new U8Buffer(2);
let u1 = u8buffer.get(32); // Allocates a 32-element array, places it in the pool, and returns it.
let u2 = u8buffer.get(64); // Allocates a 64-element array, places it in the pool, and returns it.
let u3 = u8buffer.get(32); // The next array in the pool already has 32 elements, so it returns it (same as u1).
```

The `IqBuffer` class is similar to the above, but it returns pairs of `Float32Array`s to fit I/Q samples.

```typescript
let iqbuffer = new IqBuffer(2, 1024);
let iq1 = iqbuffer.get(1024); // iq[0] is a Float32Array and iq[1] is another Float32Array
```

### Ring buffers

In the [`dsp/buffers.ts`](../src/dsp/buffers.ts) file, the `Float32RingBuffer` class implements a ring buffer for 32-bit floating-point elements.

A ring buffer contains a fixed number of elements, "_N_". When you store data into it, the oldest data is overwritten with the new data. You can get up to "_N_" elements out of the ring buffer, and those will always be the latest added elements.

```typescript
import { Float32RingBuffer } from "@jtarrio/webrtlsdr/dsp/buffers";

// Creates a 64-element ring buffer
let rb = new Float32RingBuffer(64);

for (let i = 0; i < 5; i++) {
  let samples: Float32Array = getSomeSamples();
  rb.store(samples);
}

let latest = new Float32Array(64);
rb.copyTo(latest);
// Now `latest` contains the last 64 elements of the data provided by `getSomeSamples()`.
```

## Filters

### FIR Filters

The [`dsp/coefficients.ts`](../src/dsp/coefficients.ts) file contains a `makeLowPassKernel` function that returns a low-pass filter kernel with a Hamming window.

The [`dsp/filters.ts`](../src/dsp/filters.ts) file contains a `FIRFilter` class that lets you apply an arbitrary filter kernel via convolution. You can use it to filter a `Float32Array` in place or to extract individual filtered samples.

```typescript
import { makeLowPassKernel } from "@jtarrio/webrtlsdr/dsp/coefficients";
import { FIRFilter } from "@jtarrio/webrtlsdr/dsp/filters";

const sampleRate = 1024000;
const cornerFreq = 75000;
const kernelSize = 151;
let lowpassKernel = makeLowPassKernel(sampleRate, cornerFreq, kernelSize);
let lowpass = new FIRFilter(lowpassKernel);

// Filter an array in place
let samples1: Float32Array = getSomeSamples();
lowpass.inplace(samples1);

// Get filtered samples to implement a downsampler
let samples2: Float32Array = getSomeSamples();
lowpass.loadSamples(samples2); // Loads the content of `samples2` in the filter
let output = new Float32Array(samples2.length / 2);
for (let i = 0; i < output.length; i++) {
  output[i] = lowpass.get(i * 2);
}
```

### De-emphasis filter

The [`dsp/filters.ts`](../src/dsp/filters.ts) file also contains a `Deemphasizer` class that implements a 1-pole low-pass IIR filter that takes a time constant (in microseconds) as its parameter.

```typescript
import { Deemphasizer } from "@jtarrio/webrtlsdr/dsp/filters";

const sampleRate = 1024000;
const tc = 50; // microseconds
let deemph = new Deemphasizer(sampleRate, tc);

// Filter in place
let samples: Float32Array = getSomeSamples();
deemph.inplace(samples);
```

### DC blocker

The [`dsp/filters.ts`](../src/dsp/filters.ts) file also contains a `DCBlocker` class to adaptively remove a signal at frequency 0.

## Frequency shifter

The [`dsp/filters.ts`](../src/dsp/filters.ts) file contains a `FrequencyShifter` class that mixes an input array with a complex sinusoidal to shift the frequencies of all the signals in the input array by a given value.

```typescript
import { FrequencyShifter } from "@jtarrio/webrtlsdr/dsp/filters";

const sampleRate = 1024000;
let shifter = new FrequencyShifter(sampleRate);

let samples: [Float32Array, Float32Array] = getSomeIqData();
shifter.inPlace(samples[0], samples[1], 1500); // Shifts every signal in `samples` up by 1500 Hz (a signal at 1000 Hz would now be at 2500 Hz).
```

## Resampler

The [`dsp/resamplers.ts`](../src/dsp/resamplers.ts) file contains a `RealDownsampler` class and a `ComplexDownsampler` class. Both classes are useful to reduce the sample rate of a real or complex signal, respectively.

These classes work best when there is an integer ratio between the input and output sample rates. They will downsample any ratio, but they will introduce distortion because they pick the "nearest sample" instead of doing a proper upsample/downsample sequence.

```typescript
import {
  ComplexDownsampler,
  RealDownsampler,
} from "@jtarrio/webrtlsdr/dsp/resamplers";

const inputSampleRate = 1024000;
const outputSampleRate = 256000;
const kernelSize = 151;

let realDownsampler = new RealDownsampler(
  inputSampleRate,
  outputSampleRate,
  kernelSize
);
let realInput: Float32Array = getSomeRealSamples();
let realOutput: Float32Array = realDownsampler.downsample(realInput);

let complexDownsampler = new RealDownsampler(
  inputSampleRate,
  outputSampleRate,
  kernelSize
);
let complexInput: [Float32Array, Float32Array] = getSomeIqSamples();
let complexOutput: [Float32Array, Float32Array] = complexDownsampler.downsample(
  complexInput[0],
  complexInput[1]
);
```

## Demodulators

The [`dsp/demodulators.ts`](../src/dsp/demodulators.ts) file contains several classes that implement demodulators for several schemes. All of these classes contain a `demodulate()` method that takes three `Float32Array`s with the same size: the "I" components of the input samples, the "Q" components of the input samples, and the array to store the output samples in.

- `AMDemodulator` — demodulates an amplitude-modulated signal. Its constructor takes the sample rate as a parameter.
- `FMDemodulator` — demodulates a frequency-modulated signal. Its constructor takes the maximum deviation as a fraction of the sample rate.
- `SSBDemodulator` — demodulates a single-sideband signal. Its constructor takes a value that indicates which sideband is demodulated.

Additionally, this file contains a `StereoSeparator` class that extracts the stereo signal from a demodulated WBFM signal.

```typescript
import {
  FMDemodulator,
  StereoSeparator,
} from "@jtarrio/webrtlsdr/dsp/demodulators";

const sampleRate = 1024000;
const maxDev = 75000;
let demod = new FMDemodulator(maxDev / sampleRate);

const pilotFreq = 19000;
let sep = new StereoSeparator(sampleRate, pilotFreq);

let input: [Float32Array, Float32Array] = getSomeIqSamples();
let output = new Float32Array(input[0].length);

demod.demodulate(input[0], input[1], output);
let left = output;
let right = new Float32Array(output);

let stereo = sep.separate(output);
if (stereo.found) {
  for (let i = 0; i < stereo.diff; i++) {
    left[i] -= stereo.diff[i];
    right[i] += stereo.diff[i];
  }
}
```

## Fourier transform

The [`dsp/fft.ts`](../src/dsp/fft.ts) file contains an implementation of the Fast Fourier Transform and its inverse. It only operates on buffers with lengths that are a power of 2.

Use the `FFT.ofLength()` static method to generate an instance of the `FFT` class of the appropriate length. If the size you provide is not a power of 2, the `FFT` instance will be scaled up to the next power of 2.

The `FFT` class has the following methods:

- `setWindow(window: Float32Array)` — sets the window function for this FFT. By default, a rectangular window (all ones) is used.
- `transform(real: Float32Array, imag: Float32Array): FFTOutput` - computes the FFT for the complex samples provided by `real` and `imag`. Both arrays should be the same length as the FFT size, but it is not an error if not; the function will only consider samples up to the shortest of the arrays or the FFT size and pad the rest with zeroes.
- `transformCircularBuffers(real: Float32RingBuffer, imag: Float32RingBuffer): FFTOutput` — computes the FFT for the latest samples stored in the `real` and `imag` circular buffers.
- `reverse(real: Float32Array, imag: Float32Array): FFTOutput` — computes the reverse FFT for the complex samples provided by `real` and `imag`.

The `FFTOutput` type is an object with the fields `real` and `imag`, both of type `Float32Array`.

The [`dsp/coefficients.ts`](../src/dsp/coefficients.ts) file contains an implementation of the Blackman window in the `makeBlackmanWindow()` method.

```typescript
import { FFT } from "@jtarrio/webrtlsdr/dsp/fft";
import { makeBlackmanWindow } from "@jtarrio/webrtlsdr/dsp/coefficients";

let fft = FFT.ofLength(1024);
fft.setWindow(makeBlackmanWindow(fft.lenght));
let input: [Float32Array, Float32Array] = getSomeIqSamples();
let output = fft.transform(input[0], input[1]);
```
