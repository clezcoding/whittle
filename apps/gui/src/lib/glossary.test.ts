import { describe, expect, it } from 'vitest'
import { GLOSSARY } from './glossary'

describe('GLOSSARY', () => {
  it('has a single, non-empty sentence per term', () => {
    for (const [term, text] of Object.entries(GLOSSARY)) {
      expect(text.trim().length, term).toBeGreaterThan(20)
      expect(text.match(/[.!?]/g)?.length ?? 0, term).toBe(1)
    }
  })
})
