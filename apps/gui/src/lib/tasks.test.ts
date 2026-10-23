import { describe, expect, it } from 'vitest'
import { LOG_KEEP, appendLog, clamp, finishTask, startTask, updateTask } from './tasks'

describe('task model', () => {
  it('starts hidden and running', () => {
    const t = startTask(1, 'Cleaning', 'Preparing', 1000)
    expect(t.state).toBe('running')
    expect(t.shown).toBe(false)
    expect(t.fraction).toBeNull()
  })

  it('clamps fractions into 0..1 and keeps NaN out', () => {
    expect(clamp(1.4)).toBe(1)
    expect(clamp(-0.2)).toBe(0)
    expect(clamp(Number.NaN)).toBe(0)
    const t = updateTask(startTask(1, 'x', 'y'), { fraction: 3 })
    expect(t.fraction).toBe(1)
  })

  it('keeps only the newest log lines and skips blanks', () => {
    let t = startTask(1, 'x', 'y')
    for (let i = 0; i < LOG_KEEP + 3; i++) t = appendLog(t, `line ${i}`)
    t = appendLog(t, '   ')
    expect(t.log).toHaveLength(LOG_KEEP)
    expect(t.log[t.log.length - 1]).toBe(`line ${LOG_KEEP + 2}`)
  })

  it('finishes as done at 100 percent, or as failed with the reason', () => {
    const done = finishTask(updateTask(startTask(1, 'x', 'y'), { fraction: 0.4 }), 'done', undefined, 5000)
    expect(done.fraction).toBe(1)
    expect(done.stage).toBe('Done')
    const failed = finishTask(startTask(2, 'x', 'y'), 'failed', 'npm was not found')
    expect(failed.state).toBe('failed')
    expect(failed.error).toBe('npm was not found')
  })
})
