const WORD_ANIMS: Record<string, string> = {
  hello: '/animations/words/hello.fbx',
  bye: '/animations/words/bye.fbx',
  calm: '/animations/words/calm.fbx',
  camera: '/animations/words/camera.fbx',
  canada: '/animations/words/canada.fbx',
  carefully: '/animations/words/carefully.fbx',
  celebrate: '/animations/words/celebrate.fbx',
  change: '/animations/words/change.fbx',
  my: '/animations/words/my.fbx',
  take: '/animations/words/take.fbx',
};

export function getWordAnimationUrl(word: string): string | null {
  return WORD_ANIMS[word.toLowerCase()] ?? null;
}

export function getLetterAnimationUrl(letter: string): string {
  return `/animations/letters/${letter.toUpperCase()}.fbx`;
}

export function hasWordAnimation(word: string): boolean {
  return word.toLowerCase() in WORD_ANIMS;
}
