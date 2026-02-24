import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient, LiveTranscriptionEvents, type LiveClient } from '@deepgram/sdk';

export function useSpeech() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [interimResult, setInterimResult] = useState('');
  const [finalResult, setFinalResult] = useState('');
  const [currentWord, setCurrentWord] = useState('');
  const [newFinalWords, setNewFinalWords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const connectionRef = useRef<LiveClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processedFinalRef = useRef<string>('');

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

  useEffect(() => { return cleanup; }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setIsConnecting(true);
      setInterimResult('');
      setFinalResult('');
      setCurrentWord('');
      setNewFinalWords([]);
      processedFinalRef.current = '';

      const tokenRes = await fetch('/api/deepgram/token');
      if (!tokenRes.ok) throw new Error('Failed to authenticate with Deepgram');
      const { key } = await tokenRes.json();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const deepgram = createClient(key);
      const connection = deepgram.listen.live({
        model: 'nova-3',
        smart_format: true,
        interim_results: true,
        language: 'en',
        utterance_end_ms: 1000,
      });
      connectionRef.current = connection;

      connection.on(LiveTranscriptionEvents.Open, () => {
        setIsConnecting(false);
        setIsRecording(true);

        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && connection.getReadyState() === 1) {
            connection.send(event.data);
          }
        });
        mediaRecorder.start(250);
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel.alternatives[0]?.transcript;
        if (!transcript) return;

        // Update interim display + current word for live feedback
        const words = transcript.split(' ').filter(Boolean);
        if (words.length > 0) {
          setCurrentWord(words[words.length - 1]);
        }

        if (data.is_final) {
          // Accumulate full text
          setFinalResult(prev => prev ? `${prev} ${transcript}` : transcript);
          setInterimResult('');

          // Extract new words that haven't been sent to avatar yet.
          // Keep digits (0-9) so number words like "10", "20" reach the
          // sign dictionary, which converts them to "ten", "twenty", etc.
          const cleanedNew = transcript.trim();
          if (cleanedNew) {
            const newWords = cleanedNew
              .toLowerCase()
              .replace(/[^a-z0-9\s'-]/g, '')
              .split(/\s+/)
              .filter(Boolean);

            if (newWords.length > 0) {
              setNewFinalWords(newWords);
            }
          }
          processedFinalRef.current += ' ' + cleanedNew;
        } else {
          setInterimResult(transcript);
        }
      });

      connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        setTimeout(() => {
          setFinalResult('');
          setInterimResult('');
        }, 1500);
      });

      connection.on(LiveTranscriptionEvents.Error, (err) => {
        console.error('Deepgram error:', err);
        setError('Lost connection to transcription service.');
        cleanup();
      });

      connection.on(LiveTranscriptionEvents.Close, () => { cleanup(); });

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Could not access microphone');
      cleanup();
    }
  }, [cleanup]);

  const stopRecording = useCallback(() => { cleanup(); }, [cleanup]);

  return {
    isRecording,
    isConnecting,
    interimResult,
    finalResult,
    currentWord,
    newFinalWords,
    error,
    startRecording,
    stopRecording,
    reset: () => {
      setInterimResult('');
      setFinalResult('');
      setCurrentWord('');
      setNewFinalWords([]);
      setError(null);
      processedFinalRef.current = '';
    },
  };
}
