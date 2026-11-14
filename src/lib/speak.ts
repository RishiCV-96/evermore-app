import * as Speech from 'expo-speech';

// Reads text aloud with the phone's own voice. On iPhone it makes no sound while the
// silent switch is on.
export function speak(text: string) {
  Speech.speak(text, { language: 'en-US', rate: 0.9 });
}

export function stopSpeaking() {
  Speech.stop();
}
