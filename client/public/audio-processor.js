class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 960; // ~40ms at 24kHz (was 4096 ~170ms)
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (input.length > 0 && input[0].length > 0) {
      const inputChannel = input[0];
      
      // Copy input to buffer
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;
        
        // When buffer is full, send it to main thread
        if (this.bufferIndex >= this.bufferSize) {
          try {
            this.port.postMessage({
              type: 'audioData',
              data: new Float32Array(this.buffer)
            });
          } catch (error) {
            console.error('AudioWorklet: Error sending audio data:', error);
          }
          this.bufferIndex = 0;
        }
      }
      
      // Pass through audio to output (optional - for monitoring)
      if (output.length > 0 && output[0].length > 0) {
        output[0].set(inputChannel);
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);
