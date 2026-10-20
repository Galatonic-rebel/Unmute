/**
 * Vite build base: "/" locally, "/Unmute/" on GitHub Pages. Prefixing asset
 * paths keeps them valid when the app is hosted under a sub-directory.
 */
const BASE = import.meta.env.BASE_URL ?? '/';

const WORD_ANIMS: Record<string, string> = {
  hello: `${BASE}animations/words/hello.fbx`,
  hi: `${BASE}animations/words/hello.fbx`,
  bye: `${BASE}animations/words/bye.fbx`,
  calm: `${BASE}animations/words/calm.fbx`,
  camera: `${BASE}animations/words/camera.fbx`,
  canada: `${BASE}animations/words/canada.fbx`,
  carefully: `${BASE}animations/words/carefully.fbx`,
  celebrate: `${BASE}animations/words/celebrate.fbx`,
  change: `${BASE}animations/words/change.fbx`,
  my: `${BASE}animations/words/my.fbx`,
  take: `${BASE}animations/words/take.fbx`,
};

export function getWordAnimationUrl(word: string): string | null {
  return WORD_ANIMS[word.toLowerCase()] ?? null;
}

export function getLetterAnimationUrl(letter: string): string {
  return `${BASE}animations/letters/${letter.toUpperCase()}.fbx`;
}

export function hasWordAnimation(word: string): boolean {
  return word.toLowerCase() in WORD_ANIMS;
}
