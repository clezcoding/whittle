import { describe, expect, it } from 'vitest'
import { groupBySource, prettyName, sourceOf } from './sources'
import type { Finding } from '../types'

const home = '/Users/me'
const f = (path: string, over: Partial<Finding> = {}): Finding => ({
  id: path, module: 'caches', rule: 'r', category: 'caches', title: path, path: `${home}/${path}`, bytes: 100,
  risk: 'safe', regenerable: true, note: null, related: null, confidence: 1, modified: null, ...over,
})

describe('prettyName', () => {
  it('turns reverse-DNS names into the product name', () => {
    expect(prettyName('com.spotify.client')).toBe('Spotify')
    expect(prettyName('com.getdropbox.dropbox')).toBe('Dropbox')
    expect(prettyName('com.gone.agent.plist')).toBe('Gone')
    expect(prettyName('com.adobe.Reader')).toBe('Reader')
  })
  it('leaves human names alone', () => {
    expect(prettyName('Sublime Text 3')).toBe('Sublime Text 3')
    expect(prettyName('Google')).toBe('Google')
  })
})

describe('sourceOf', () => {
  it('puts everything under Library/Developer into Xcode', () => {
    expect(sourceOf(f('Library/Developer/Xcode/DerivedData/Atlas-1'), home)).toMatchObject({ label: 'Xcode', kind: 'tool' })
    expect(sourceOf(f('Library/Developer/CoreSimulator/Caches/x'), home).label).toBe('Xcode')
  })
  it('names the app behind a Library folder', () => {
    expect(sourceOf(f('Library/Caches/com.spotify.client'), home)).toMatchObject({ label: 'Spotify', kind: 'app' })
    expect(sourceOf(f('Library/Application Support/Slack/Cache'), home)).toMatchObject({ label: 'Slack', kind: 'app' })
  })
  it('uses the project name for dev projects', () => {
    const p = f('Developer/clared-web/node_modules', { module: 'projects', title: 'node_modules · clared-web' })
    expect(sourceOf(p, home)).toMatchObject({ label: 'clared-web', kind: 'project' })
    expect(sourceOf(f('Developer/old-tool/target', { module: 'projects', title: 'Rust target' }), home).label).toBe('old-tool')
  })
  it('knows package-manager directories and Downloads', () => {
    expect(sourceOf(f('.npm/_cacache'), home).label).toBe('npm')
    expect(sourceOf(f('.cargo/registry/cache/x'), home).label).toBe('Cargo')
    expect(sourceOf(f('Downloads/Docker.dmg'), home)).toMatchObject({ label: 'Downloads', kind: 'folder' })
  })
  it('does not crash on paths outside the home folder', () => {
    expect(sourceOf({ ...f('x'), path: '/opt/thing/cache' }, home).kind).toBe('folder')
  })
})

describe('groupBySource', () => {
  it('sums, sorts by size and counts the safe part', () => {
    const items = [
      f('Library/Developer/Xcode/DerivedData/a', { bytes: 500 }),
      f('Library/Developer/Xcode/DerivedData/b', { bytes: 300, risk: 'caution' }),
      f('Library/Caches/com.spotify.client', { bytes: 600 }),
    ]
    const g = groupBySource(items, home)
    expect(g.map((x) => x.source.label)).toEqual(['Xcode', 'Spotify'])
    expect(g[0]).toMatchObject({ bytes: 800, safeBytes: 500 })
    expect(g[0].items[0].bytes).toBe(500)
  })
})
