import { describe, it, expect } from 'vitest'
import { mapQuizToWeights, calculateFitScore } from '../src/services/quizEngine.js'

describe('mapQuizToWeights', () => {
  it('assigns weight 5 to the first priority, decrementing down', () => {
    const result = mapQuizToWeights({
      priority_order: ['quality', 'cost', 'location', 'staff', 'availability', 'facilities'],
    })
    expect(result.weights.quality).toBe(5)
    expect(result.weights.cost).toBe(4)
    expect(result.weights.commute).toBe(3)
    expect(result.weights.staff).toBe(2)
    expect(result.weights.availability).toBe(1)
    expect(result.weights.sentiment).toBe(1) // 6th item = max(1, 5-5) = 1
  })

  it('returns all 1s for empty priority_order', () => {
    const result = mapQuizToWeights({})
    expect(result.weights.quality).toBe(1)
    expect(result.weights.cost).toBe(1)
    expect(result.weights.commute).toBe(1)
  })

  it('boosts availability by +2 for asap urgency', () => {
    const result = mapQuizToWeights({
      urgency: 'asap',
      priority_order: [],
    })
    expect(result.weights.availability).toBe(3) // 1 + 2
  })

  it('boosts availability by +1 for 3_months urgency', () => {
    const result = mapQuizToWeights({
      urgency: '3_months',
      priority_order: [],
    })
    expect(result.weights.availability).toBe(2) // 1 + 1
  })

  it('caps availability at 5', () => {
    const result = mapQuizToWeights({
      urgency: 'asap',
      priority_order: ['availability'], // already weight 5
    })
    expect(result.weights.availability).toBe(5) // capped
  })

  it('passes through budget and grade filters', () => {
    const result = mapQuizToWeights({
      budget_min: 500,
      budget_max: 1500,
      min_grade: 'Good',
      must_haves: ['meals_included', 'outdoor_space'],
    })
    expect(result.budget_min).toBe(500)
    expect(result.budget_max).toBe(1500)
    expect(result.min_grade).toBe('Good')
    expect(result.must_haves).toEqual(['meals_included', 'outdoor_space'])
  })

  it('handles null must_haves gracefully', () => {
    const result = mapQuizToWeights({ must_haves: null })
    expect(result.must_haves).toEqual([])
  })
})

describe('calculateFitScore', () => {
  it('computes weighted average of available dimensions', () => {
    const nursery = {
      quality_score: 80,
      cost_score: 60,
      availability_score: null,
      staff_score: null,
      sentiment_score: 100,
      commute_score: 50,
    }
    const weights = { quality: 5, cost: 3, availability: 1, staff: 1, sentiment: 2, commute: 4 }
    // Only non-null: quality(80*5=400), cost(60*3=180), sentiment(100*2=200), commute(50*4=200)
    // Sum = 980, totalWeight = 5+3+2+4=14
    // 980/14 = 70
    expect(calculateFitScore(nursery, weights)).toBe(70)
  })

  it('returns null when all dimensions are null', () => {
    const nursery = {
      quality_score: null,
      cost_score: null,
      availability_score: null,
      staff_score: null,
      sentiment_score: null,
      commute_score: null,
    }
    const weights = { quality: 5, cost: 3, availability: 1, staff: 1, sentiment: 2, commute: 4 }
    expect(calculateFitScore(nursery, weights)).toBeNull()
  })

  it('handles a single non-null dimension', () => {
    const nursery = {
      quality_score: 90,
      cost_score: null,
      availability_score: null,
      staff_score: null,
      sentiment_score: null,
      commute_score: null,
    }
    const weights = { quality: 3, cost: 1, availability: 1, staff: 1, sentiment: 1, commute: 1 }
    // 90*3 / 3 = 90
    expect(calculateFitScore(nursery, weights)).toBe(90)
  })

  it('uses weight 1 as default for missing weight keys', () => {
    const nursery = { quality_score: 100, commute_score: 50 }
    const weights = { quality: 5 } // commute not specified, defaults to 1
    // 100*5 + 50*1 = 550, totalWeight = 6
    // 550/6 ≈ 92
    expect(calculateFitScore(nursery, weights)).toBe(92)
  })
})
