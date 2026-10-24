import { describe, expect, it } from 'vitest'
import { assignLetterBugLetters, canSpellWord, makeDistractors, makeMathProblem, shuffle } from './puzzles'

/** Deterministic random numbers so tests are repeatable. */
function seeded(seed = 42) {
  let n = seed
  return () => { n = (n * 1664525 + 1013904223) % 2 ** 32; return n / 2 ** 32 }
}

describe('canSpellWord', () => {
  it('spells a word from exactly its letters, in any order', () => {
    expect(canSpellWord('CAT', ['T', 'A', 'C'])).toBe(true)
  })
  it('ignores extra letters', () => {
    expect(canSpellWord('CAT', ['X', 'C', 'A', 'Q', 'T'])).toBe(true)
  })
  it('fails when a letter is missing', () => {
    expect(canSpellWord('CAT', ['C', 'A'])).toBe(false)
  })
  it('uses each collected letter only once', () => {
    expect(canSpellWord('BOOK', ['B', 'O', 'K'])).toBe(false)
    expect(canSpellWord('BOOK', ['B', 'O', 'O', 'K'])).toBe(true)
  })
})

describe('assignLetterBugLetters', () => {
  it('includes every letter of the word, padded with decoys up to the bug count', () => {
    const letters = assignLetterBugLetters('DRAGON', 9, seeded())
    expect(letters).toHaveLength(9)
    expect(canSpellWord('DRAGON', letters)).toBe(true)
  })
  it('only uses decoys that are not in the word', () => {
    const letters = assignLetterBugLetters('DRAGON', 9, seeded(7))
    const decoys = [...letters]
    for (const l of 'DRAGON') decoys.splice(decoys.indexOf(l), 1)
    expect(decoys).toHaveLength(3)
    for (const d of decoys) expect('DRAGON').not.toContain(d)
  })
  it('never drops word letters when there are fewer bugs than letters', () => {
    expect(assignLetterBugLetters('PUZZLE', 3, seeded())).toHaveLength(6)
  })
})

describe('shuffle', () => {
  it('returns a permutation and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5, 6]
    const out = shuffle(input, seeded())
    expect([...out].sort()).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('makeMathProblem', () => {
  it('cycles addition, subtraction, multiplication', () => {
    const rng = seeded()
    expect(makeMathProblem(1, rng).q).toContain('+')
    expect(makeMathProblem(2, rng).q).toContain('-')
    expect(makeMathProblem(3, rng).q).toContain('×')
    expect(makeMathProblem(4, rng).q).toContain('+')
  })
  it('always has a correct, positive whole-number answer', () => {
    const rng = seeded(99)
    for (let n = 1; n <= 300; n++) {
      const { q, answer } = makeMathProblem(n, rng)
      const [a, op, b] = q.split(' ')
      const expected = op === '+' ? +a + +b : op === '-' ? +a - +b : +a * +b
      expect(answer).toBe(expected)
      expect(answer).toBeGreaterThan(0)
      expect(Number.isInteger(answer)).toBe(true)
    }
  })
})

describe('makeDistractors', () => {
  it('returns distinct wrong answers near the right one', () => {
    const d = makeDistractors(12, 3)
    expect(d).toHaveLength(3)
    expect(new Set(d).size).toBe(3)
    expect(d).not.toContain(12)
    for (const v of d) expect(Math.abs(v - 12)).toBeLessThanOrEqual(2)
  })
  it('never offers zero or negative answers', () => {
    const d = makeDistractors(1, 3)
    expect(d).toHaveLength(3)
    for (const v of d) expect(v).toBeGreaterThan(0)
  })
})
