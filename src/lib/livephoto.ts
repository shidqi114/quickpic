// 5-Second Live Photo (Boomerang / Animated Video) Buffer Engine

export class LivePhotoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;

  startRecording(stream: MediaStream) {
    try {
      this.recordedChunks = [];
      const options: MediaRecorderOptions = {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4',
      };

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(200); // chunk every 200ms
      this.isRecording = true;
    } catch (e) {
      console.warn('LivePhotoRecorder start error:', e);
    }
  }

  stopRecording(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve('');
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        this.isRecording = false;
        resolve(videoUrl);
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        resolve('');
      }
    });
  }
}

export const livePhotoRecorder = new LivePhotoRecorder();
