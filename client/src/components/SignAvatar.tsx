import { motion, AnimatePresence } from 'framer-motion';
import { Hand, Sparkles, HandMetal, Ear, SquareUser } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SignAvatarProps {
  currentWord: string;
  isRecording: boolean;
}

export function SignAvatar({ currentWord, isRecording }: SignAvatarProps) {
  const [activeIcon, setActiveIcon] = useState(0);

  // Cycle through different "hand" poses based on the word changing to simulate signing
  useEffect(() => {
    if (currentWord) {
      setActiveIcon((prev) => (prev + 1) % 3);
    }
  }, [currentWord]);

  return (
    <div className="relative w-full aspect-square md:aspect-video rounded-3xl glass-panel overflow-hidden flex flex-col items-center justify-center p-8">
      {/* Background ambient animations */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      
      {isRecording && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-6 left-6 flex items-center gap-2 text-primary font-medium tracking-wide text-sm bg-primary/10 px-4 py-2 rounded-full"
        >
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Listening & Translating
        </motion.div>
      )}

      <div className="relative z-10 flex-1 flex items-center justify-center w-full">
        {isRecording ? (
          <div className="relative">
            {/* Pulsing rings */}
            <motion.div
              animate={{
                scale: [1, 1.5, 2],
                opacity: [0.5, 0.2, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
              }}
              className="absolute inset-0 rounded-full bg-primary/30"
            />
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIcon}
                initial={{ scale: 0.8, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 1.2, opacity: 0, rotate: 15 }}
                transition={{ duration: 0.3, type: "spring" }}
                className="relative bg-gradient-to-br from-primary to-accent p-8 rounded-full shadow-2xl shadow-primary/20"
              >
                {activeIcon === 0 && <Hand className="w-24 h-24 text-white" strokeWidth={1.5} />}
                {activeIcon === 1 && <HandMetal className="w-24 h-24 text-white" strokeWidth={1.5} />}
                {activeIcon === 2 && <Sparkles className="w-24 h-24 text-white" strokeWidth={1.5} />}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-muted-foreground"
          >
            <Ear className="w-20 h-20 mb-6 opacity-20" strokeWidth={1} />
            <h3 className="text-2xl font-display font-medium text-foreground mb-2">Ready to Translate</h3>
            <p className="text-center max-w-sm text-sm">
              Click the microphone button below to start translating spoken English into American Sign Language gestures.
            </p>
          </motion.div>
        )}
      </div>

      {/* Current Word Display */}
      <div className="h-16 w-full flex items-center justify-center mt-auto border-t border-white/5">
        <AnimatePresence mode="popLayout">
          {currentWord ? (
            <motion.div
              key={currentWord}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-3xl font-display font-bold text-gradient tracking-tight"
            >
              {currentWord.toUpperCase()}
            </motion.div>
          ) : (
            isRecording && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1 text-muted-foreground"
              >
                <SquareUser className="w-5 h-5 animate-pulse" />
                <span className="text-sm tracking-widest uppercase">Waiting for speech...</span>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
