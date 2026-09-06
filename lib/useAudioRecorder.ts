import { useState, useRef } from 'react';
import { Platform, Alert } from 'react-native';

export type RecordingState = 'idle' | 'recording' | 'stopped';

export function useAudioRecorder() {
  const [state, setState] = useState<RecordingState>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  // Native refs (expo-av)
  const nativeRecordingRef = useRef<any>(null);

  // Web refs (MediaRecorder API)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isWeb = Platform.OS === 'web';

  const start = async (): Promise<boolean> => {
    try {
      if (isWeb) {
        // ---- WEB: use browser MediaRecorder API ----
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunksRef.current = [];
        const mr = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg',
        });
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.start(200);
        mediaRecorderRef.current = mr;
        setState('recording');
        return true;
      } else {
        // ---- NATIVE: use expo-av ----
        const { Audio } = require('expo-av');
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert('Permission Required', 'Microphone access is needed to record voice.');
          return false;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        nativeRecordingRef.current = recording;
        setState('recording');
        return true;
      }
    } catch (e) {
      console.error('Recording start error:', e);
      return false;
    }
  };

  const stop = async (): Promise<{ uri?: string; blob?: Blob }> => {
    setState('stopped');
    try {
      if (isWeb) {
        return new Promise((resolve) => {
          const mr = mediaRecorderRef.current;
          if (!mr) return resolve({});
          mr.onstop = () => {
            const recordedBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
            setBlob(recordedBlob);
            const url = URL.createObjectURL(recordedBlob);
            setUri(url);
            mr.stream?.getTracks().forEach((t) => t.stop());
            resolve({ blob: recordedBlob, uri: url });
          };
          mr.stop();
        });
      } else {
        const rec = nativeRecordingRef.current;
        if (!rec) return {};
        await rec.stopAndUnloadAsync();
        const recordingUri = rec.getURI();
        setUri(recordingUri ?? null);
        return { uri: recordingUri ?? undefined };
      }
    } catch (e) {
      console.error('Recording stop error:', e);
      return {};
    }
  };

  const reset = () => {
    setState('idle');
    setUri(null);
    setBlob(null);
    nativeRecordingRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  };

  return { state, uri, blob, isWeb, start, stop, reset };
}
