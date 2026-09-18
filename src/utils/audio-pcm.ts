/**
 * Audio PCM conversion and resampling utilities for Google Gemini Live API
 * Input requirement: 16-bit linear PCM, mono, 16,000 Hz, base64 encoded
 * Output requirement: 16-bit linear PCM, mono, 24,000 Hz, base64 encoded
 */

/**
 * Resamples a Float32Array from an arbitrary browser sample rate (e.g. 44.1kHz, 48kHz)
 * down or up to target sample rate (default: 16000 Hz for Gemini Live) using linear interpolation.
 */
export function resampleTo16kHz(
  input: Float32Array,
  fromSampleRate: number,
  toSampleRate = 16000,
): Float32Array {
  if (fromSampleRate === toSampleRate || input.length === 0) {
    return input;
  }

  const ratio = fromSampleRate / toSampleRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const indexFloor = Math.floor(srcIndex);
    const indexCeil = Math.min(input.length - 1, indexFloor + 1);
    const fraction = srcIndex - indexFloor;
    output[i] = input[indexFloor] * (1 - fraction) + input[indexCeil] * fraction;
  }

  return output;
}

/**
 * Converts Float32Array audio buffer [-1.0, 1.0] to 16-bit linear PCM base64 (little-endian)
 */
export function floatTo16BitPCMBase64(input: Float32Array): string {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true); // little-endian
  }
  return arrayBufferToBase64(buffer);
}

/**
 * Converts ArrayBuffer to Base64 string safely
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Decodes base64 16-bit linear PCM audio into an AudioBuffer at the specified sample rate (default 24000)
 */
export function base64PCMToAudioBuffer(
  base64Data: string,
  audioContext: AudioContext,
  sampleRate = 24000,
): AudioBuffer {
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const int16Array = new Int16Array(bytes.buffer);
  const frameCount = int16Array.length;
  const audioBuffer = audioContext.createBuffer(1, frameCount, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    // Convert 16-bit signed integer back to Float32 [-1.0, 1.0]
    channelData[i] = int16Array[i] / 32768.0;
  }

  return audioBuffer;
}
