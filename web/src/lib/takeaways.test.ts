import { changeKind, changeLabel, changeSentence, levelSentence, SUPPRESSED_TAKEAWAY, takeaway, vsOverallSentence } from './takeaways'

const level = { p: 0.14837, population: 'teens ages 12–17', phrase: 'had a major depressive episode in the past year', when: '2024' }

describe('levelSentence', () => {
  it('leads with "about 1 in N" and gives the percentage and year', () => {
    expect(levelSentence(level)).toBe('About 1 in 7 teens ages 12–17 had a major depressive episode in the past year (15%, 2024).')
  })
  it('uses the population phrase from the catalog', () => {
    expect(levelSentence({ ...level, population: 'female teens ages 12–17', p: 0.21777 })).toBe(
      'About 1 in 5 female teens ages 12–17 had a major depressive episode in the past year (22%, 2024).',
    )
  })
  it('uses the percentage alone when more than half', () => {
    expect(levelSentence({ p: 0.62, population: 'teens ages 12–17', phrase: 'liked going to school', when: '2024' })).toBe('62% of teens ages 12–17 liked going to school (2024).')
  })
  it('names pooled years', () => {
    expect(levelSentence({ ...level, p: 0.18129, when: '2021–2024 combined' })).toMatch(/\(18%, 2021–2024 combined\)\.$/)
  })
})

describe('changeKind', () => {
  it('is null when the test is missing', () => {
    expect(changeKind(null, null)).toBeNull()
    expect(changeKind(undefined, 0.01)).toBeNull()
    expect(changeKind(-0.05, null)).toBeNull()
  })
  it('follows the sign when significant', () => {
    expect(changeKind(-0.057, 0.0001)).toBe('fell')
    expect(changeKind(0.02, 0.049)).toBe('rose')
  })
  it('is "same" when not significant, whatever the sign', () => {
    expect(changeKind(-0.04, 0.05)).toBe('same')
    expect(changeKind(0.04, 0.3)).toBe('same')
  })
})

describe('changeSentence', () => {
  it('says down from when the change is significant and negative', () => {
    expect(changeSentence({ priorP: 0.20537, priorYear: 2021, diff: -0.057, pValue: 0 })).toBe("That's down from 21% in 2021.")
  })
  it('says up from when significant and positive', () => {
    expect(changeSentence({ priorP: 0.1, priorYear: 2022, diff: 0.03, pValue: 0.01 })).toBe("That's up from 10% in 2022.")
  })
  it('says about the same when not significant', () => {
    expect(changeSentence({ priorP: 0.20537, priorYear: 2021, diff: -0.012, pValue: 0.19 })).toBe("That's about the same as in 2021 (21%).")
  })
  it('is null when the change cannot be tested', () => {
    expect(changeSentence({ priorP: 0.2, priorYear: 2021, diff: null, pValue: null })).toBeNull()
  })
})

describe('changeLabel', () => {
  it('labels every kind', () => {
    expect(changeLabel('fell', 2021)).toBe('Fell since 2021')
    expect(changeLabel('rose', 2022)).toBe('Rose since 2022')
    expect(changeLabel('same', 2021)).toBe('About the same as 2021')
  })
})

describe('vsOverallSentence', () => {
  const base = { overallP: 0.14837, people: 'teens' }
  it('says higher when both the group test and the level test are significant', () => {
    expect(vsOverallSentence({ ...base, overallSignificant: true, diff: 0.069, pValue: 0 })).toBe("That's higher than all teens (15%).")
  })
  it('says lower for a negative difference', () => {
    expect(vsOverallSentence({ ...base, overallSignificant: true, diff: -0.066, pValue: 0.001 })).toBe("That's lower than all teens (15%).")
  })
  it('says similar when the group test is not significant, even if the level test is', () => {
    expect(vsOverallSentence({ ...base, overallSignificant: false, diff: 0.069, pValue: 0.001 })).toBe("That's similar to all teens (15%).")
  })
  it('says similar when the level test is not significant', () => {
    expect(vsOverallSentence({ ...base, overallSignificant: true, diff: 0.01, pValue: 0.4 })).toBe("That's similar to all teens (15%).")
  })
  it('says similar when the level was not tested', () => {
    expect(vsOverallSentence({ ...base, overallSignificant: true, diff: null, pValue: null })).toBe("That's similar to all teens (15%).")
  })
})

describe('takeaway', () => {
  it('is only the suppression note for a suppressed cell', () => {
    expect(takeaway({ suppressed: true, level })).toEqual([SUPPRESSED_TAKEAWAY])
    expect(takeaway({ suppressed: false, level: null })).toEqual([SUPPRESSED_TAKEAWAY])
  })
  it('is the level sentence alone without tests', () => {
    expect(takeaway({ suppressed: false, level })).toHaveLength(1)
  })
  it('adds the change and the comparison with everyone', () => {
    const sentences = takeaway({
      suppressed: false,
      level: { ...level, population: 'female teens ages 12–17', p: 0.21777 },
      change: { priorP: 0.29752, priorYear: 2021, diff: -0.07975, pValue: 0 },
      vsOverall: { overallP: 0.14837, people: 'teens', overallSignificant: true, diff: 0.069, pValue: 0 },
    })
    expect(sentences).toEqual([
      'About 1 in 5 female teens ages 12–17 had a major depressive episode in the past year (22%, 2024).',
      "That's down from 30% in 2021.",
      "That's higher than all teens (15%).",
    ])
  })
  it('skips an untestable change', () => {
    expect(takeaway({ suppressed: false, level, change: { priorP: 0.2, priorYear: 2021, diff: null, pValue: null } })).toHaveLength(1)
  })
})

describe('wording', () => {
  it('never uses causal or alarm words', () => {
    const banned = /\b(cause|caused|causes|because|due to|leads? to|drives?|crisis|alarming|epidemic|skyrocket|surge|plummet|soar)/i
    const outputs = [
      levelSentence(level),
      levelSentence({ ...level, p: 0.7 }),
      changeSentence({ priorP: 0.2, priorYear: 2021, diff: -0.05, pValue: 0 }),
      changeSentence({ priorP: 0.2, priorYear: 2021, diff: 0.05, pValue: 0 }),
      changeSentence({ priorP: 0.2, priorYear: 2021, diff: 0.05, pValue: 0.5 }),
      vsOverallSentence({ overallP: 0.15, people: 'teens', overallSignificant: true, diff: 0.1, pValue: 0 }),
      vsOverallSentence({ overallP: 0.15, people: 'teens', overallSignificant: true, diff: -0.1, pValue: 0 }),
      vsOverallSentence({ overallP: 0.15, people: 'teens', overallSignificant: false, diff: -0.1, pValue: 0 }),
      changeLabel('fell', 2021),
      changeLabel('rose', 2021),
      changeLabel('same', 2021),
      SUPPRESSED_TAKEAWAY,
    ]
    for (const text of outputs) expect(text).not.toMatch(banned)
  })
})
