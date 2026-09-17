/**
 * Audio PCM conversion utilities for Gemini Live API
 * Input: Float32Array from microphone (16kHz) -> 16-bit linear PCM base64
 * Output: 16-bit linear PCM base64 (24kHz) -> AudioBuffer / playback
 */

/**
 * Converts Float32Array audio buffer to 16-bit linear PCM base64
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
