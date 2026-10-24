/**
 * Pure puzzle logic (no Phaser), shared by GameScene and PuzzleMenu and covered
 * by puzzles.test.ts.
 */

export type Rng = () => number

/** Fisher-Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Can `word` be spelled from `letters`? Each collected letter can be used once. */
export function canSpellWord(word: string, letters: readonly string[]): boolean {
  const pool = [...letters]
  for (const letter of word) {
    const idx = pool.indexOf(letter)
    if (idx === -1) return false
    pool.splice(idx, 1)
  }
  return true
}

/**
 * Letters to put on a level's bugs: every letter of the word, plus random
 * letters that aren't in the word to make up `numBugs`, in random order.
 */
export function assignLetterBugLetters(word: string, numBugs: number, rng: Rng = Math.random): string[] {
  const wordLetters = word.split('')
  const used = new Set(wordLetters)
  const decoys = shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !used.has(l)), rng)
    .slice(0, Math.max(0, numBugs - wordLetters.length))
  return shuffle([...wordLetters, ...decoys], rng)
}

export interface MathProblem { q: string; answer: number }

const between = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1))

/**
 * The n-th math duck problem (1-based), cycling addition, subtraction, multiplication.
 * Answers are always positive whole numbers small enough for young players.
 */
export function makeMathProblem(n: number, rng: Rng = Math.random): MathProblem {
  switch ((n - 1) % 3) {
    case 0: { const a = between(2, 9, rng), b = between(2, 9, rng); return { q: `${a} + ${b}`, answer: a + b } }
    case 1: { const b = between(2, 6, rng), a = b + between(2, 7, rng); return { q: `${a} - ${b}`, answer: a - b } }
    default: { const a = between(2, 5, rng), b = between(2, 5, rng); return { q: `${a} × ${b}`, answer: a * b } }
  }
}

/** `count` wrong answers close to `correct`, all positive and distinct. */
export function makeDistractors(correct: number, count: number): number[] {
  const used = new Set<number>([correct])
  const out: number[] = []
  for (let offset = 1; out.length < count && offset < 30; offset++) {
    for (const v of [correct - offset, correct + offset]) {
      if (out.length < count && v > 0 && !used.has(v)) { out.push(v); used.add(v) }
    }
  }
  return out
}
