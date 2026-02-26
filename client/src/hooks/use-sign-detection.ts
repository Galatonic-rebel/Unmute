import { useState, useRef, useCallback, useEffect } from "react";
import { PoseDetector, type DetectionResult } from "@/lib/pose-detector";
import { SignMatcher, type MatchCandidate } from "@/lib/sign-matcher";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const TARGET_FPS = 15;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

export interface DebugInfo {
  posY: number;
  region: string;
  candidates: MatchCandidate[];
}

export interface UseSignDetectionReturn {
  isDetecting: boolean;
  recognizedWords: string[];
  currentSign: string | null;
  landmarksRef: React.RefObject<NormalizedLandmark[][] | null>;
  bodyLandmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  debugInfo: DebugInfo | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startDetection: () => Promise<void>;
  stopDetection: () => void;
  reset: () => void;
}

export function useSignDetection(): UseSignDetectionReturn {
  const [isDetecting, setIsDetecting] = useState(false);
  const [recognizedWords, setRecognizedWords] = useState<string[]>([]);
  const [currentSign, setCurrentSign] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  const landmarksRef = useRef<NormalizedLandmark[][] | null>(null);
  const bodyLandmarksRef = useRef<NormalizedLandmark[] | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<PoseDetector | null>(null);
  const matcherRef = useRef<SignMatcher | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const isDetectingRef = useRef(false);
  const debugTickRef = useRef(0);

  const stopDetection = useCallback(() => {
    isDetectingRef.current = false;
    setIsDetecting(false);

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (detectorRef.current) {
      detectorRef.current.destroy();
      detectorRef.current = null;
    }

    matcherRef.current = null;
    landmarksRef.current = null;
    bodyLandmarksRef.current = null;
    setCurrentSign(null);
    setDebugInfo(null);
  }, []);

  const detectionLoop = useCallback((timestamp: number) => {
    if (!isDetectingRef.current) return;

    const elapsed = timestamp - lastFrameTimeRef.current;
    if (elapsed >= FRAME_INTERVAL) {
      lastFrameTimeRef.current = timestamp - (elapsed % FRAME_INTERVAL);

      const video = videoRef.current;
      const detector = detectorRef.current;
      const matcher = matcherRef.current;

      if (video && detector && matcher && video.readyState >= 2) {
        const result: DetectionResult = detector.detect(video);

        landmarksRef.current = result.landmarks;
        bodyLandmarksRef.current = result.bodyLandmarks;

        const matchResult = matcher.match({
          right: result.right,
          left: result.left,
          rightHandPos: result.rightHandPos,
          leftHandPos: result.leftHandPos,
          detectedFace: result.detectedFace,
        });

        debugTickRef.current++;
        if (debugTickRef.current % 3 === 0) {
          setDebugInfo({
            posY: matcher.lastPosY,
            region: matcher.lastRegion,
            candidates: matcher.lastCandidates,
          });
        }

        if (matchResult) {
          setCurrentSign(matchResult.word);
          setRecognizedWords((prev) => [...prev, matchResult.word]);
        } else if (!result.right && !result.left) {
          setCurrentSign(null);
        }
      }
    }

    rafIdRef.current = requestAnimationFrame(detectionLoop);
  }, []);

  const startDetection = useCallback(async () => {
    stopDetection();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    video.srcObject = stream;
    await video.play();

    const detector = new PoseDetector();
    await detector.init(video);
    detectorRef.current = detector;

    matcherRef.current = new SignMatcher();

    isDetectingRef.current = true;
    setIsDetecting(true);
    lastFrameTimeRef.current = 0;
    debugTickRef.current = 0;

    rafIdRef.current = requestAnimationFrame(detectionLoop);
  }, [stopDetection, detectionLoop]);

  const reset = useCallback(() => {
    setRecognizedWords([]);
    setCurrentSign(null);
    if (matcherRef.current) {
      matcherRef.current.reset();
    }
  }, []);

  useEffect(() => {
    return () => {
      isDetectingRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (detectorRef.current) {
        detectorRef.current.destroy();
      }
    };
  }, []);

  return {
    isDetecting,
    recognizedWords,
    currentSign,
    landmarksRef,
    bodyLandmarksRef,
    debugInfo,
    videoRef,
    startDetection,
    stopDetection,
    reset,
  };
}
