import { RTL2832U_Provider } from "@jtarrio/webrtlsdr/rtlsdr/rtl2832u";

var elements = {};
var provider;
var device;

async function main() {
  preparePage();
  elements.startButton.addEventListener("click", onStartButtonClick);
  elements.frequencyInput.addEventListener("change", onFrequencyInputChange);
  elements.autoGainBox.addEventListener("change", onAutoGainBoxChange);
  elements.gainInput.addEventListener("change", onGainInputChange);
}

// We ask the user to click "start" so the WebUSB API will let us connect to the device.
async function onStartButtonClick() {
  let frequency = Number(elements.frequencyInput.value);
  if (isNaN(frequency)) {
    log(`Invalid frequency: ${elements.frequencyInput.value}`);
    return;
  }
  let gain = elements.autoGainBox.checked
    ? null
    : Number(elements.gainInput.value);
  if (isNaN(gain)) {
    log(`Invalid gain: ${elements.gainInput.value}`);
    return;
  }

  elements.startButton.disabled = true;
  try {
    // We keep the provider around so the user only needs to choose the USB device once.
    if (!provider) provider = new RTL2832U_Provider();
    device = await provider.get();
    // Set the device parameters
    await device.setSampleRate(1024000);
    await device.setCenterFrequency(frequency);
    await device.setGain(gain);
    // Reset the buffer and then start reading samples
    await device.resetBuffer();
    for (let i = 0; i < 10; i++) {
      let samples = await device.readSamples(65536);
      let dB = measurePower(samples);
      log(`${samples.frequency} Hz — ${dB} dB`);
    }
    // Close the device when done. You can reopen it with provider.get()
    await device.close();
  } catch (e) {
    log(`Error: ${e}`);
  } finally {
    elements.startButton.disabled = false;
  }
}

function measurePower(samples) {
  let u8Samples = new Uint8Array(samples.data);
  let power = 0;
  for (let i = 0; i < u8Samples.length; i += 2) {
    let I = (2 * u8Samples[i]) / 255 - 1;
    let Q = (2 * u8Samples[i + 1]) / 255 - 1;
    power += I * I + Q * Q;
  }
  let dB = 10 * Math.log10(power / (u8Samples.length / 2));
  return Math.round(dB * 100) / 100;
}

function log(msg) {
  elements.logArea.value =
    `${new Date().toISOString()} — ${msg}\n` + elements.logArea.value;
}

function onFrequencyInputChange() {
  setNumberInput(
    elements.frequencyInput,
    () => radio.getFrequency(),
    (v) => radio.setFrequency(v)
  );
}

function onAutoGainBoxChange() {
  let checked = elements.autoGainBox.checked;
  elements.gainInput.disabled = checked;
  if (checked) {
    radio.setGain(null);
  } else {
    onGainChange();
  }
}

function onGainInputChange() {
  setNumberInput(
    elements.gainInput,
    () => radio.getGain(),
    (v) => radio.setGain(v)
  );
}

function setNumberInput(element, getter, setter) {
  let v = Number(element.value);
  if (isNaN(v)) {
    v = getter();
  } else {
    setter(v);
  }
  element.value = String(v);
}

function preparePage() {
  for (let id of [
    "startButton",
    "stopButton",
    "frequencyInput",
    "autoGainBox",
    "gainInput",
    "logArea",
  ]) {
    elements[id] = document.getElementById(id);
  }
}

window.addEventListener("load", main);
