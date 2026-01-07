# Web RTL-SDR

Web RTL-SDR is a TypeScript library that lets you access RTL-SDR devices from a webpage running on a Chromium-based browser.

You can use Web RTL-SDR from JavaScript and TypeScript applications.

Web RTL-SDR provides a low-level API that lets you manipulate the RTL-SDR stick directly, and a high-level API that lets you write a stereo FM demodulator in less than 10 lines of JavaScript through the [Signals library](https://github.com/jtarrio/signals/).

## Requirements

Web RTL-SDR uses the WebUSB API, which is only available on Chromium-based browsers running on a computer or Android device.

You can only use the WebUSB API in a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts). This means that your webpage must be served over HTTPS or hosted on `localhost`.

When you design your webpage, take into account that you can only connect to an RTL-SDR device in response to a user interaction. This means that you cannot open the RTL-SDR device when the page is opened or automatically in other ways; the user must have clicked a button, pressed a key, or interacted with the webpage right before you try to connect to the RTL-SDR device.

## Installing

You can install Web RTL-SDR using NPM:

```shell
npm install @jtarrio/webrtlsdr
```

## Using Web RTL-SDR

You can use the low-level API if you need to access the RTL-SDR stick directly, or the high-level API if you want to demodulate a stream of samples.

- Accessing the RTL-SDR stick through the [low-level API](lowlevel.md)
- Creating a radio demodulator through the [high-level API](highlevel.md)

## Migrating from old versions

- [Migrating from version 2 to version 3](migrate-2-to-3.md)
