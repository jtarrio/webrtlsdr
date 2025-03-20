import { Demodulator } from "@jtarrio/webrtlsdr/demod/demodulator";
import {
  getBandwidth,
  getMode,
  getSchemes,
  getSquelch,
  hasBandwidth,
  hasSquelch,
  hasStereo,
  withBandwidth,
  withSquelch,
  withStereo,
} from "@jtarrio/webrtlsdr/demod/scheme";
import { Radio } from "@jtarrio/webrtlsdr/radio/radio";
import { RTL2832U_Provider } from "@jtarrio/webrtlsdr/rtlsdr/rtl2832u";
import { DirectSampling } from "@jtarrio/webrtlsdr/rtlsdr/rtldevice";

var elements = {};
var demodulator;
var radio;
var modes = {};

async function main() {
  // Create the demodulator and radio and connect them.
  const sampleRate = 1024000;
  demodulator = new Demodulator(sampleRate);
  radio = new Radio(new RTL2832U_Provider(), demodulator, sampleRate);

  // Set the radio and demodulator parameters.
  radio.setFrequency(88500000);
  radio.setDirectSamplingMethod(DirectSampling.Off);
  radio.setFrequencyCorrection(0);
  radio.setGain(null);
  demodulator.setFrequencyOffset(0);
  demodulator.setVolume(1);
  demodulator.setMode(getMode("WBFM"));

  // Receive radio and demodulator events.
  radio.addEventListener("radio", onRadio);
  demodulator.addEventListener("stereo-status", onStereoStatus);

  preparePage();

  // Start playing the radio when the user clicks a button.
  elements.playButton.addEventListener("click", () => radio.start());
  elements.stopButton.addEventListener("click", () => radio.stop());
  elements.frequencyInput.addEventListener("change", onFrequencyInputChange);
  elements.offsetInput.addEventListener("change", onOffsetInputChange);
  elements.ppmInput.addEventListener("change", onPpmInputChange);
  elements.autoGainBox.addEventListener("change", onAutoGainBoxChange);
  elements.gainInput.addEventListener("change", onGainInputChange);
  elements.volumeInput.addEventListener("change", onVolumeInputChange);
  elements.schemeSelect.addEventListener("change", onSchemeSelectChange);
  elements.bandwidthInput.addEventListener("change", onBandwidthInputChange);
  elements.squelchInput.addEventListener("change", onSquelchInputChange);
  elements.stereoBox.addEventListener("change", onStereoBoxChange);
}

function onFrequencyInputChange() {
  setNumberInput(
    elements.frequencyInput,
    () => radio.getFrequency(),
    (v) => radio.setFrequency(v)
  );
}

function onOffsetInputChange() {
  setNumberInput(
    elements.offsetInput,
    () => demodulator.getFrequencyOffset(),
    (v) => demodulator.setFrequencyOffset(v)
  );
}

function onPpmInputChange() {
  setNumberInput(
    elements.ppmInput,
    () => radio.getFrequencyCorrection(),
    (v) => radio.setFrequencyCorrection(v)
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

function onVolumeInputChange() {
  setNumberInput(
    elements.volumeInput,
    () => Math.floor(demodulator.getVolume() * 100),
    (v) => demodulator.setVolume(v / 100)
  );
}

function onSchemeSelectChange() {
  let mode = demodulator.getMode();
  modes[mode.scheme] = demodulator.getMode();
  let scheme = elements.schemeSelect.selectedOptions[0].value;
  mode = modes[scheme];
  if (mode === undefined) return;
  demodulator.setMode(mode);
  for (let option of elements.schemeSelect.options) {
    option.selected = option.value == mode.scheme;
  }
  elements.bandwidthInput.disabled = !hasBandwidth(mode);
  elements.bandwidthInput.value = String(getBandwidth(mode));
  elements.squelchInput.disabled = !hasSquelch(mode);
  elements.squelchInput.value = String(getSquelch(mode));
  elements.stereoBox.checked = hasStereo(mode);
}

function onBandwidthInputChange() {
  setNumberInput(
    elements.bandwidthInput,
    () => getBandwidth(demodulator.getMode()),
    (v) => demodulator.setMode(withBandwidth(v, demodulator.getMode()))
  );
}

function onSquelchInputChange() {
  setNumberInput(
    elements.squelchInput,
    () => getSquelch(demodulator.getMode()),
    (v) => demodulator.setMode(withSquelch(v, demodulator.getMode()))
  );
}

function onStereoBoxChange() {
  let checked = elements.stereoBox.checked;
  demodulator.setMode(withStereo(checked, demodulator.getMode()));
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

function onRadio(e) {
  let msg = `${new Date().toISOString()} — ${e.detail.type}`;
  if (e.detail.type == "directSampling") msg += ` — ${e.detail.active}`;
  if (e.detail.type == "error") msg += ` — ${e.detail.exception}`;
  elements.logArea.value = msg + "\n" + elements.logArea.value;
  if (e.detail.type == "started" || e.detail.type == "stopped")
    setElementValues();
}

function onStereoStatus(e) {
  let msg = `${new Date().toISOString()} — stereo — ${e.detail ? "on" : "off"}`;
  elements.logArea.value = msg + "\n" + elements.logArea.value;
}

function preparePage() {
  for (let id of [
    "playButton",
    "stopButton",
    "frequencyInput",
    "offsetInput",
    "ppmInput",
    "autoGainBox",
    "gainInput",
    "volumeInput",
    "schemeSelect",
    "bandwidthInput",
    "squelchInput",
    "stereoBox",
    "logArea",
  ]) {
    elements[id] = document.getElementById(id);
  }

  for (let mode of getSchemes()) {
    let option = document.createElement("option");
    option.value = mode;
    option.textContent = mode;
    elements.schemeSelect.appendChild(option);
    modes[mode] = getMode(mode);
  }

  elements.playButton.disabled = radio.isPlaying();
  elements.stopButton.disabled = !radio.isPlaying();
  elements.frequencyInput.value = String(radio.getFrequency());
  elements.offsetInput.value = String(demodulator.getFrequencyOffset());
  elements.ppmInput.value = String(radio.getFrequencyCorrection());
  let gain = radio.getGain();
  elements.autoGainBox.checked = gain == null;
  elements.gainInput.disabled = gain == null;
  if (gain != null) {
    elements.gainInput.value = String(gain);
  }
  elements.volumeInput.value = String(
    Math.floor(demodulator.getVolume() * 100)
  );
  let mode = demodulator.getMode();
  for (let option of elements.schemeSelect.options) {
    option.selected = option.value == mode.scheme;
  }
  elements.bandwidthInput.disabled = !hasBandwidth(mode);
  elements.bandwidthInput.value = String(getBandwidth(mode));
  elements.squelchInput.disabled = !hasSquelch(mode);
  elements.squelchInput.value = String(getSquelch(mode));
  elements.stereoBox.checked = hasStereo(mode);
}

window.addEventListener("load", main);
