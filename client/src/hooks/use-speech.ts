import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient, LiveTranscriptionEvents, type LiveClient } from '@deepgram/sdk';

export function useSpeech() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [interimResult, setInterimResult] = useState('');
  const [finalResult, setFinalResult] = useState('');
  const [currentWord, setCurrentWord] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const connectionRef = useRef<LiveClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (connectionRef.current) {
      connectionRef.current.requestClose();
      connectionRef.current = null;
    }
    setIsRecording(false);
    setIsConnecting(false);
  }, []);

  // Ensure cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setIsConnecting(true);
      setInterimResult('');
      setFinalResult('');
      setCurrentWord('');

      // 1. Fetch Token
      const tokenRes = await fetch('/api/deepgram/token');
      if (!tokenRes.ok) throw new Error('Failed to authenticate with Deepgram');
      const { key } = await tokenRes.json();

      // 2. Get User Media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 3. Initialize Deepgram
      const deepgram = createClient(key);
      const connection = deepgram.listen.live({
        model: 'nova-3',
        smart_format: true,
        interim_results: true,
        language: 'en',
      });

      connectionRef.current = connection;

      connection.on(LiveTranscriptionEvents.Open, () => {
        setIsConnecting(false);
        setIsRecording(true);

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && connection.getReadyState() === 1) {
            connection.send(event.data);
          }
        });

        // Send audio chunks every 250ms
        mediaRecorder.start(250);
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel.alternatives[0]?.transcript;
        if (transcript) {
          // Extract current word for avatar animation
          const words = transcript.split(' ');
          const lastWord = words[words.length - 1];
          if (lastWord) setCurrentWord(lastWord);

          if (data.is_final) {
            setFinalResult((prev) => {
              const newFinal = prev ? `${prev} ${transcript}` : transcript;
              return newFinal;
            });
            setInterimResult('');
          } else {
            setInterimResult(transcript);
          }
        }
      });

      connection.on(LiveTranscriptionEvents.Error, (err) => {
        console.error('Deepgram error:', err);
        setError('Lost connection to transcription service.');
        cleanup();
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        cleanup();
      });

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Could not access microphone');
      cleanup();
    }
  }, [cleanup]);

  const stopRecording = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    isConnecting,
    interimResult,
    finalResult,
    currentWord,
    error,
    startRecording,
    stopRecording,
    reset: () => {
      setInterimResult('');
      setFinalResult('');
      setCurrentWord('');
      setError(null);
    }
  };
}
