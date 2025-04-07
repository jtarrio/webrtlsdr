// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/** Interface for classes that get samples from a Radio class. */
export interface SampleReceiver {
  /** Sets the sample rate. */
  setSampleRate(sampleRate: number): void;

  /** Receives samples that should be demodulated. */
  receiveSamples(I: Float32Array, Q: Float32Array, frequency: number): void;
}

/**
 * A "composite" sample receiver that executes its component receivers in sequence.
 */
export class CompositeReceiver implements SampleReceiver {
  /** Creates a ReceiverSequence out of the given SampleReceivers. */
  static of(first: SampleReceiver, ...rest: SampleReceiver[]): SampleReceiver {
    let list: SampleReceiver[] = [];
    if (first instanceof CompositeReceiver) {
      list.push(...first.receivers);
    } else {
      list.push(first);
    }
    for (let next of rest) {
      if (next instanceof CompositeReceiver) {
        list.push(...next.receivers);
      } else {
        list.push(next);
      }
    }
    if (list.length == 1) return list[0];
    return new CompositeReceiver(list);
  }

  private constructor(public receivers: SampleReceiver[]) {}

  setSampleRate(sampleRate: number): void {
    for (let receiver of this.receivers) {
      receiver.setSampleRate(sampleRate);
    }
  }

  receiveSamples(I: Float32Array, Q: Float32Array, frequency: number): void {
    for (let receiver of this.receivers) {
      receiver.receiveSamples(I, Q, frequency);
    }
  }
}
