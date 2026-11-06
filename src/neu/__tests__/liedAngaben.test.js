import { describe, it, expect } from 'vitest'
import { liedAngaben } from '../LiedAngaben'

const T = key => ({ piece_key: 'Tonart', piece_takt: 'Takt', piece_tempo: 'Tempo', tools_bpm: 'BPM' })[key]

describe('liedAngaben', () => {
  it('zeigt Tonart, Takt und Tempo in dieser Reihenfolge', () => {
    expect(liedAngaben({ tonart: 'C#', takt: '4/4', tempo: '160' }, T)).toEqual([
      ['Tonart', 'C#'],
      ['Takt', '4/4'],
      ['Tempo', '160 BPM'],
    ])
  })

  it('hängt BPM nur an reine Zahlen an', () => {
    expect(liedAngaben({ tempo: 'Andante / 80' }, T)).toEqual([['Tempo', 'Andante / 80']])
  })

  it('lässt leere Felder weg', () => {
    expect(liedAngaben({ tonart: '', takt: null, tempo: '  ' }, T)).toEqual([])
    expect(liedAngaben({}, T)).toEqual([])
  })
})
