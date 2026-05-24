// Trimmed OpenAPI spec for ChatGPT Custom GPT — max 30 operations.
// Covers all public endpoints useful for a parent-facing assistant.

const server =
  process.env.API_PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  'https://nursery-finder-6u7r.onrender.com'

const urnParam = {
  in: 'path',
  name: 'urn',
  required: true,
  schema: { type: 'string' },
  description: 'Ofsted URN (unique reference number)',
}
const districtParam = {
  in: 'path',
  name: 'district',
  required: true,
  schema: { type: 'string' },
  description: 'UK postcode district (e.g. SW11, N1, BS6)',
}

const openapiGpt = {
  openapi: '3.1.0',
  info: {
    title: 'NurseryMatch API',
    version: '1.0.0',
    description:
      'Search and compare 27,000+ Ofsted-rated UK nurseries, browse family-friendly areas, check travel times, and read parenting guides. Public, free, no auth required. Data source: Ofsted Early Years register (OGL v3.0).',
  },
  servers: [{ url: server, description: 'Production' }],
  paths: {
    // -----------------------------------------------------------------------
    // 1. POST /nurseries/smart-search
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/smart-search': {
      post: {
        operationId: 'smartSearchNurseries',
        summary: 'Search nurseries by postcode, place name, or nursery name',
        tags: ['Nurseries'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string', description: 'Postcode, place name, or nursery name' },
                  radius_km: { type: 'number', default: 5, minimum: 0.1, maximum: 25 },
                  grade: { type: 'string', enum: ['Outstanding', 'Good', 'Requires Improvement', 'Inadequate'] },
                  has_availability: { type: 'boolean' },
                  min_rating: { type: 'number', minimum: 1, maximum: 5 },
                  provider_type: { type: 'string' },
                  has_funded_2yr: { type: 'boolean' },
                  has_funded_3yr: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Search results with nurseries, distances, and metadata' } },
      },
    },
    // -----------------------------------------------------------------------
    // 2. POST /nurseries/search
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/search': {
      post: {
        operationId: 'searchNurseriesByPostcode',
        summary: 'Search nurseries near a specific UK postcode with pagination',
        tags: ['Nurseries'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['postcode'],
                properties: {
                  postcode: { type: 'string' },
                  radius_km: { type: 'number', default: 5 },
                  grade: { type: 'string' },
                  funded_2yr: { type: 'boolean' },
                  funded_3yr: { type: 'boolean' },
                  page: { type: 'integer', default: 1 },
                  limit: { type: 'integer', default: 20, maximum: 50 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Paginated nursery search results' } },
      },
    },
    // -----------------------------------------------------------------------
    // 3. POST /nurseries/compare
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/compare': {
      post: {
        operationId: 'compareNurseries',
        summary: 'Compare 2-10 nurseries side by side',
        tags: ['Nurseries'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['urns'],
                properties: {
                  urns: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Comparison data for each nursery' } },
      },
    },
    // -----------------------------------------------------------------------
    // 4. GET /nurseries/autocomplete
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/autocomplete': {
      get: {
        operationId: 'autocompleteNurseries',
        summary: 'Autocomplete nursery names (min 2 chars)',
        tags: ['Nurseries'],
        parameters: [
          { in: 'query', name: 'q', required: true, schema: { type: 'string', minLength: 2 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } },
        ],
        responses: { 200: { description: 'Matching nursery names with URNs' } },
      },
    },
    // -----------------------------------------------------------------------
    // 5. GET /nurseries/towns
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/towns': {
      get: {
        operationId: 'listTowns',
        summary: 'List all towns that have nurseries',
        tags: ['Nurseries'],
        parameters: [
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 200, maximum: 500 } },
        ],
        responses: { 200: { description: 'List of towns with nursery counts' } },
      },
    },
    // -----------------------------------------------------------------------
    // 6. GET /nurseries/by-town/{town}
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/by-town/{town}': {
      get: {
        operationId: 'getNurseriesInTown',
        summary: 'List nurseries in a town sorted by Ofsted grade',
        tags: ['Nurseries'],
        parameters: [
          { in: 'path', name: 'town', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Nurseries in town with stats' } },
      },
    },
    // -----------------------------------------------------------------------
    // 7. GET /nurseries/{urn}
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/{urn}': {
      get: {
        operationId: 'getNursery',
        summary: 'Get full nursery details by Ofsted URN',
        tags: ['Nurseries'],
        parameters: [urnParam],
        responses: { 200: { description: 'Full nursery profile with grades, fees, availability, contact' } },
      },
    },
    // -----------------------------------------------------------------------
    // 8. GET /nurseries/{urn}/similar
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/{urn}/similar': {
      get: {
        operationId: 'getSimilarNurseries',
        summary: 'Find similar nurseries within 3km',
        tags: ['Nurseries'],
        parameters: [
          urnParam,
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 5 } },
        ],
        responses: { 200: { description: 'Similar nurseries' } },
      },
    },
    // -----------------------------------------------------------------------
    // 9. GET /nurseries/{urn}/availability
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/{urn}/availability': {
      get: {
        operationId: 'getNurseryAvailability',
        summary: 'Get current availability by age group',
        tags: ['Nurseries'],
        parameters: [urnParam],
        responses: { 200: { description: 'Availability by age group (baby, toddler, pre-school)' } },
      },
    },
    // -----------------------------------------------------------------------
    // 10. GET /nurseries/{urn}/progression
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/{urn}/progression': {
      get: {
        operationId: 'getSchoolProgression',
        summary: 'Get school progression path (nursery → primary → secondary)',
        tags: ['Nurseries'],
        parameters: [urnParam],
        responses: { 200: { description: 'Feeder school chain' } },
      },
    },
    // -----------------------------------------------------------------------
    // 11. GET /nurseries/{urn}/reviews
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/{urn}/reviews': {
      get: {
        operationId: 'getNurseryReviews',
        summary: 'Get parent reviews for a nursery',
        tags: ['Reviews'],
        parameters: [
          urnParam,
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: { 200: { description: 'Paginated parent reviews with ratings' } },
      },
    },
    // -----------------------------------------------------------------------
    // 12. GET /nurseries/{urn}/questions
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/{urn}/questions': {
      get: {
        operationId: 'getNurseryQuestions',
        summary: 'Get Q&A questions and answers for a nursery',
        tags: ['Nurseries'],
        parameters: [urnParam],
        responses: { 200: { description: 'Questions with answers from parents and providers' } },
      },
    },
    // -----------------------------------------------------------------------
    // 13. GET /nurseries/{urn}/summary
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/{urn}/summary': {
      get: {
        operationId: 'getAiNurserySummary',
        summary: 'Get AI-generated nursery summary',
        tags: ['AI'],
        parameters: [urnParam],
        responses: { 200: { description: 'AI summary of nursery based on Ofsted, reviews, and profile' } },
      },
    },
    // -----------------------------------------------------------------------
    // 14. GET /nurseries/{urn}/review-synthesis
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/{urn}/review-synthesis': {
      get: {
        operationId: 'getAiReviewSynthesis',
        summary: 'Get AI synthesis of parent reviews — themes, strengths, concerns',
        tags: ['AI'],
        parameters: [urnParam],
        responses: { 200: { description: 'AI synthesis of review themes' } },
      },
    },
    // -----------------------------------------------------------------------
    // 15. GET /areas/{district}
    // -----------------------------------------------------------------------
    '/api/v1/areas/{district}': {
      get: {
        operationId: 'getArea',
        summary: 'Get area stats: family score, nursery quality, crime, parks, property prices',
        tags: ['Areas'],
        parameters: [districtParam],
        responses: { 200: { description: 'Area statistics for the postcode district' } },
      },
    },
    // -----------------------------------------------------------------------
    // 16. GET /areas/family-search
    // -----------------------------------------------------------------------
    '/api/v1/areas/family-search': {
      get: {
        operationId: 'findFamilyAreas',
        summary: 'Find family-friendly areas near a postcode ranked by family score',
        tags: ['Areas'],
        parameters: [
          { in: 'query', name: 'postcode', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'radius_km', schema: { type: 'number', default: 15 } },
          { in: 'query', name: 'min_family_score', schema: { type: 'number' } },
          { in: 'query', name: 'min_nursery_pct', schema: { type: 'number' } },
          { in: 'query', name: 'sort', schema: { type: 'string', enum: ['family_score', 'nursery_score', 'distance'] } },
        ],
        responses: { 200: { description: 'Ranked family-friendly areas' } },
      },
    },
    // -----------------------------------------------------------------------
    // 17. GET /areas/{district}/nurseries
    // -----------------------------------------------------------------------
    '/api/v1/areas/{district}/nurseries': {
      get: {
        operationId: 'getAreaNurseries',
        summary: 'List all nurseries in a postcode district',
        tags: ['Areas'],
        parameters: [districtParam],
        responses: { 200: { description: 'Nurseries in the district with grades and stats' } },
      },
    },
    // -----------------------------------------------------------------------
    // 18. GET /properties/districts
    // -----------------------------------------------------------------------
    '/api/v1/properties/districts': {
      get: {
        operationId: 'browseDistricts',
        summary: 'Browse UK districts by property price, type, and family score',
        tags: ['Properties'],
        parameters: [
          { in: 'query', name: 'min_price', schema: { type: 'number' } },
          { in: 'query', name: 'max_price', schema: { type: 'number' } },
          { in: 'query', name: 'property_type', schema: { type: 'string', enum: ['all', 'flat', 'terraced', 'semi', 'detached'] } },
          { in: 'query', name: 'region', schema: { type: 'string' } },
          { in: 'query', name: 'sort', schema: { type: 'string', enum: ['price_asc', 'price_desc', 'family_score', 'yield'] } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 60, maximum: 200 } },
        ],
        responses: { 200: { description: 'Districts with prices and family scores' } },
      },
    },
    // -----------------------------------------------------------------------
    // 19. POST /travel/time
    // -----------------------------------------------------------------------
    '/api/v1/travel/time': {
      post: {
        operationId: 'calculateTravelTime',
        summary: 'Calculate travel time between two points (walk, cycle, or drive)',
        tags: ['Travel'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['from', 'to'],
                properties: {
                  from: {
                    type: 'object',
                    description: 'Origin — provide postcode, lat/lng, or urn',
                    properties: {
                      postcode: { type: 'string' },
                      lat: { type: 'number' },
                      lng: { type: 'number' },
                      urn: { type: 'string' },
                    },
                  },
                  to: {
                    type: 'object',
                    description: 'Destination — provide postcode, lat/lng, or urn',
                    properties: {
                      postcode: { type: 'string' },
                      lat: { type: 'number' },
                      lng: { type: 'number' },
                      urn: { type: 'string' },
                    },
                  },
                  mode: { type: 'string', enum: ['walk', 'cycle', 'drive'], default: 'walk' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Travel time in minutes and distance in km' } },
      },
    },
    // -----------------------------------------------------------------------
    // 20. POST /travel/isochrone
    // -----------------------------------------------------------------------
    '/api/v1/travel/isochrone': {
      post: {
        operationId: 'getIsochrone',
        summary: 'Get travel time zones as GeoJSON polygons (commute bands)',
        tags: ['Travel'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['from'],
                properties: {
                  from: {
                    type: 'object',
                    properties: {
                      postcode: { type: 'string' },
                      lat: { type: 'number' },
                      lng: { type: 'number' },
                    },
                  },
                  durations_min: { type: 'array', items: { type: 'integer' }, default: [15, 30, 45, 60] },
                  mode: { type: 'string', enum: ['walk', 'cycle', 'drive'], default: 'drive' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'GeoJSON FeatureCollection with isochrone polygons' } },
      },
    },
    // -----------------------------------------------------------------------
    // 21. GET /schools/near
    // -----------------------------------------------------------------------
    '/api/v1/schools/near': {
      get: {
        operationId: 'findSchoolsNearby',
        summary: 'Find schools near a location',
        tags: ['Schools'],
        parameters: [
          { in: 'query', name: 'lat', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'lng', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'radius_km', schema: { type: 'number', default: 2 } },
          { in: 'query', name: 'phase', schema: { type: 'string', description: 'Primary or Secondary' } },
        ],
        responses: { 200: { description: 'Schools with distance, phase, and Ofsted grade' } },
      },
    },
    // -----------------------------------------------------------------------
    // 22. GET /schools/{urn}
    // -----------------------------------------------------------------------
    '/api/v1/schools/{urn}': {
      get: {
        operationId: 'getSchool',
        summary: 'Get a school by URN',
        tags: ['Schools'],
        parameters: [{ in: 'path', name: 'urn', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'School details' } },
      },
    },
    // -----------------------------------------------------------------------
    // 23. GET /public/nursery/{urn}.md
    // -----------------------------------------------------------------------
    '/api/v1/public/nursery/{urn}.md': {
      get: {
        operationId: 'getNurseryMarkdown',
        summary: 'Get nursery profile as formatted markdown (LLM-friendly)',
        tags: ['Markdown'],
        parameters: [urnParam],
        responses: { 200: { description: 'Nursery profile in markdown format' } },
      },
    },
    // -----------------------------------------------------------------------
    // 24. GET /public/area/{district}.md
    // -----------------------------------------------------------------------
    '/api/v1/public/area/{district}.md': {
      get: {
        operationId: 'getAreaMarkdown',
        summary: 'Get area summary as formatted markdown (LLM-friendly)',
        tags: ['Markdown'],
        parameters: [districtParam],
        responses: { 200: { description: 'Area summary in markdown format' } },
      },
    },
    // -----------------------------------------------------------------------
    // 25. GET /blog
    // -----------------------------------------------------------------------
    '/api/v1/blog': {
      get: {
        operationId: 'listGuides',
        summary: 'List all nursery guides and advice articles',
        tags: ['Guides'],
        responses: { 200: { description: 'Guide list with title, excerpt, date, and slug' } },
      },
    },
    // -----------------------------------------------------------------------
    // 26. GET /blog/{slug}
    // -----------------------------------------------------------------------
    '/api/v1/blog/{slug}': {
      get: {
        operationId: 'getGuide',
        summary: 'Get a full guide article by slug',
        tags: ['Guides'],
        parameters: [
          { in: 'path', name: 'slug', required: true, schema: { type: 'string' }, description: 'Guide slug (e.g. how-to-choose-nursery)' },
        ],
        responses: { 200: { description: 'Full guide with title, body, tags, and date' } },
      },
    },
    // -----------------------------------------------------------------------
    // 27. POST /nurseries/fees
    // -----------------------------------------------------------------------
    '/api/v1/nurseries/fees': {
      post: {
        operationId: 'reportNurseryFee',
        summary: 'Submit an anonymous fee report for a nursery',
        tags: ['Nurseries'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nursery_urn', 'fee_per_month'],
                properties: {
                  nursery_urn: { type: 'string' },
                  fee_per_month: { type: 'number', minimum: 100, maximum: 5000 },
                  hours_per_week: { type: 'number' },
                  age_group: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Fee report submitted' } },
      },
    },
    // -----------------------------------------------------------------------
    // 28. POST /ai/conversational-search
    // -----------------------------------------------------------------------
    '/api/v1/ai/conversational-search': {
      post: {
        operationId: 'aiConversationalSearch',
        summary: 'AI conversational nursery search — ask in natural language',
        tags: ['AI'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string', description: 'Natural language nursery question' },
                  history: { type: 'array', items: { type: 'object' }, description: 'Conversation history' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'AI response with nursery recommendations' } },
      },
    },
    // -----------------------------------------------------------------------
    // 29. GET /promotions/nearby
    // -----------------------------------------------------------------------
    '/api/v1/promotions/nearby': {
      get: {
        operationId: 'getNearbyPromotions',
        summary: 'Get promoted nurseries near a location',
        tags: ['Nurseries'],
        parameters: [
          { in: 'query', name: 'lat', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'lng', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'radius_km', schema: { type: 'number', default: 5 } },
        ],
        responses: { 200: { description: 'Promoted nurseries with details' } },
      },
    },
    // -----------------------------------------------------------------------
    // 30. GET /health
    // -----------------------------------------------------------------------
    '/api/v1/health': {
      get: {
        operationId: 'healthCheck',
        summary: 'API health check',
        tags: ['Health'],
        responses: { 200: { description: 'API status and database connectivity' } },
      },
    },
  },
}

export default openapiGpt
