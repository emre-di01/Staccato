import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false

let transcriber = null

self.onmessage = async ({ data }) => {
  if (data.type === 'load') {
    try {
      transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-base',
        { progress_callback: p => self.postMessage({ type: 'download', ...p }) }
      )
      self.postMessage({ type: 'ready' })
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message })
    }
    return
  }

  if (data.type === 'transcribe') {
    try {
      const audio = new Float32Array(data.audio)
      const result = await transcriber(audio, {
        language: data.language || null,
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      })
      self.postMessage({ type: 'result', text: result.text.trim() })
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message })
    }
  }
}
