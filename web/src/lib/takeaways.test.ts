import { changeKind, changeSentence, countWord, IMPRECISE_TAKEAWAY, isWideInterval, levelSentence, SAME_ANSWER_TAKEAWAY, SUPPRESSED_TAKEAWAY, suppressedTakeaway, takeaway, tileChange, vsOverallKind, vsOverallSentence } from './takeaways'

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
  it('says down from when the change is significant and negative, rounding the compared value with the latest one', () => {
    expect(changeSentence({ priorP: 0.20537, priorYear: 2021, diff: -0.057, pValue: 0, p: 0.14837 })).toBe("That's down from 21% in 2021.")
  })
  it('says up from when significant and positive', () => {
    expect(changeSentence({ priorP: 0.1, priorYear: 2022, diff: 0.03, pValue: 0.01, p: 0.13 })).toBe("That's up from 10% in 2022.")
  })
  it('says about the same when not significant', () => {
    expect(changeSentence({ priorP: 0.20537, priorYear: 2021, diff: -0.012, pValue: 0.19, p: 0.19322 })).toBe("That's about the same as in 2021 (21%).")
  })
  it('gives one decimal when the two values would otherwise read the same', () => {
    expect(changeSentence({ priorP: 0.343, priorYear: 2021, diff: -0.005, pValue: 0.6, p: 0.338 })).toBe("That's about the same as in 2021 (34.3%).")
  })
  it('is null when the change cannot be tested', () => {
    expect(changeSentence({ priorP: 0.2, priorYear: 2021, diff: null, pValue: null, p: 0.2 })).toBeNull()
  })
})

describe('tileChange', () => {
  it('words every kind like the explorer sentences', () => {
    expect(tileChange('fell', 0.20537, 2021, 0.14837)).toBe('↓ Down from 21% in 2021')
    expect(tileChange('rose', 0.052, 2022, 0.071)).toBe('↑ Up from 5.2% in 2022')
    expect(tileChange('same', 0.11, 2021, 0.104)).toBe('About the same as in 2021 (11%)')
    expect(tileChange('same', 0.104, 2021, 0.0996)).toBe('About the same as in 2021 (10.4%)')
  })
})

describe('vsOverallSentence', () => {
  const base = { overallP: 0.14837, p: 0.21777, people: 'teens' }
  it('says higher when both the group test and the level test are significant', () => {
    expect(vsOverallSentence({ ...base, overallSignificant: true, diff: 0.069, pValue: 0 })).toBe("That's higher than all teens (15%).")
  })
  it('says lower for a negative difference', () => {
    expect(vsOverallSentence({ ...base, p: 0.0821, overallSignificant: true, diff: -0.066, pValue: 0.001 })).toBe("That's lower than all teens (15%).")
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

describe('vsOverallKind', () => {
  it('needs both tests for higher or lower, and is null without a test', () => {
    expect(vsOverallKind(true, 0.069, 0)).toBe('higher')
    expect(vsOverallKind(true, -0.066, 0.001)).toBe('lower')
    expect(vsOverallKind(false, 0.069, 0)).toBe('similar')
    expect(vsOverallKind(true, 0.01, 0.4)).toBe('similar')
    expect(vsOverallKind(true, null, null)).toBeNull()
  })
})

describe('countWord', () => {
  it('spells out one to ten and keeps larger numbers as digits', () => {
    expect(countWord(1)).toBe('one')
    expect(countWord(4)).toBe('four')
    expect(countWord(10)).toBe('ten')
    expect(countWord(11)).toBe('11')
  })
})

describe('takeaway', () => {
  it('is only the suppression note for a suppressed cell, worded for its reason', () => {
    expect(takeaway({ suppressed: true, level })).toEqual([SUPPRESSED_TAKEAWAY])
    expect(takeaway({ suppressed: false, level: null })).toEqual([SUPPRESSED_TAKEAWAY])
    expect(takeaway({ suppressed: true, reason: 'estimate is too imprecise', level: null })).toEqual([IMPRECISE_TAKEAWAY])
  })
  it('has one sentence for each suppression reason', () => {
    expect(suppressedTakeaway('fewer than 50 respondents')).toBe('Not enough responses to report this reliably.')
    expect(suppressedTakeaway('estimate is too imprecise')).toBe('This estimate is too imprecise to report reliably.')
    expect(suppressedTakeaway('estimate is 0% or 100%')).toBe("Everyone surveyed in this group gave the same answer, so this can't be estimated reliably.")
    expect(suppressedTakeaway('no respondents')).toBe(SUPPRESSED_TAKEAWAY)
    expect(suppressedTakeaway(null)).toBe(SUPPRESSED_TAKEAWAY)
  })
  it('is the level sentence alone without tests', () => {
    expect(takeaway({ suppressed: false, level })).toHaveLength(1)
  })
  it('adds the change and the comparison with everyone', () => {
    const sentences = takeaway({
      suppressed: false,
      level: { ...level, population: 'female teens ages 12–17', p: 0.21777 },
      change: { priorP: 0.29752, priorYear: 2021, diff: -0.07975, pValue: 0, p: 0.21777 },
      vsOverall: { overallP: 0.14837, p: 0.21777, people: 'teens', overallSignificant: true, diff: 0.069, pValue: 0 },
    })
    expect(sentences).toEqual([
      'About 1 in 5 female teens ages 12–17 had a major depressive episode in the past year (22%, 2024).',
      "That's down from 30% in 2021.",
      "That's higher than all teens (15%).",
    ])
  })
  it('skips an untestable change', () => {
    expect(takeaway({ suppressed: false, level, change: { priorP: 0.2, priorYear: 2021, diff: null, pValue: null, p: 0.14837 } })).toHaveLength(1)
  })
})

describe('wording', () => {
  it('never uses causal or alarm words', () => {
    const banned = /\b(cause|caused|causes|because|due to|leads? to|drives?|crisis|alarming|epidemic|skyrocket|surge|plummet|soar)/i
    const outputs = [
      levelSentence(level),
      levelSentence({ ...level, p: 0.7 }),
      changeSentence({ priorP: 0.2, priorYear: 2021, diff: -0.05, pValue: 0, p: 0.15 }),
      changeSentence({ priorP: 0.2, priorYear: 2021, diff: 0.05, pValue: 0, p: 0.25 }),
      changeSentence({ priorP: 0.2, priorYear: 2021, diff: 0.05, pValue: 0.5, p: 0.25 }),
      vsOverallSentence({ overallP: 0.15, p: 0.25, people: 'teens', overallSignificant: true, diff: 0.1, pValue: 0 }),
      vsOverallSentence({ overallP: 0.15, p: 0.05, people: 'teens', overallSignificant: true, diff: -0.1, pValue: 0 }),
      vsOverallSentence({ overallP: 0.15, p: 0.05, people: 'teens', overallSignificant: false, diff: -0.1, pValue: 0 }),
      tileChange('fell', 0.2, 2021, 0.15),
      tileChange('rose', 0.2, 2021, 0.25),
      tileChange('same', 0.2, 2021, 0.19),
      SUPPRESSED_TAKEAWAY,
      IMPRECISE_TAKEAWAY,
      SAME_ANSWER_TAKEAWAY,
    ]
    for (const text of outputs) expect(text).not.toMatch(banned)
  })
})

describe('restricted denominators and wide intervals', () => {
  it('composes the denominator clause with the population', () => {
    expect(
      levelSentence({
        p: 0.5234,
        lo: 0.49,
        hi: 0.556,
        population: 'female teens ages 12–17 who had a major depressive episode in the past year',
        phrase: 'got treatment or medication for depression in the past year',
        when: '2024',
      }),
    ).toBe('52% of female teens ages 12–17 who had a major depressive episode in the past year got treatment or medication for depression in the past year (2024).')
    expect(vsOverallSentence({ overallP: 0.4512, p: 0.5234, people: 'teens who had a major depressive episode in the past year', overallSignificant: true, diff: 0.07, pValue: 0.001 })).toBe(
      "That's higher than all teens who had a major depressive episode in the past year (45%).",
    )
  })
  it('calls an interval wide from 10 points or a 3x ratio, and only with both ends', () => {
    expect(isWideInterval(0.02, 0.12)).toBe(true)
    expect(isWideInterval(0.02, 0.061)).toBe(true)
    expect(isWideInterval(0.1, 0.19)).toBe(false)
    expect(isWideInterval(0.1375, 0.1599)).toBe(false)
    expect(isWideInterval(0, 0.05)).toBe(true)
    expect(isWideInterval(null, 0.2)).toBe(false)
    expect(isWideInterval(0.1, undefined)).toBe(false)
  })
  it('gives the range instead of "1 in N" when the interval is wide', () => {
    expect(levelSentence({ ...level, p: 0.061, lo: 0.021, hi: 0.152 })).toBe('Between 2.1% and 15.2% of teens ages 12–17 had a major depressive episode in the past year (best estimate 6.1%, 2024).')
    expect(levelSentence({ ...level, p: 0.14837, lo: 0.13754, hi: 0.15991 })).toMatch(/^About 1 in 7 /)
  })
})
