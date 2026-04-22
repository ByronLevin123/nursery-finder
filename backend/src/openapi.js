// OpenAPI 3.1 spec for the public read-only NurseryMatch API.
// Designed to be consumable by ChatGPT Custom GPT actions and other LLM agents.

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'NurseryMatch Public API',
    version: '1.0.0',
    description:
      'Read-only public API for UK nursery, area and property data. Source: Ofsted Early Years register (Open Government Licence v3.0), HM Land Registry, ONS, data.police.uk, Environment Agency. Always cite Ofsted when reproducing nursery grades.',
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    contact: { name: 'NurseryMatch', url: 'https://nurserymatch.com' },
  },
  servers: [{ url: 'https://nursery-finder-6u7r.onrender.com', description: 'Production' }],
  tags: [
    { name: 'nurseries', description: 'Search and look up nurseries' },
    { name: 'areas', description: 'Postcode-district family scores and stats' },
    { name: 'properties', description: 'Land Registry-backed district browser' },
    { name: 'overlays', description: 'Schools and other geo overlays' },
    { name: 'public-markdown', description: 'LLM-friendly markdown summaries' },
  ],
  paths: {
    '/api/v1/nurseries/search': {
      post: {
        tags: ['nurseries'],
        summary: 'Search nurseries near a UK postcode',
        operationId: 'searchNurseries',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['postcode'],
                properties: {
                  postcode: { type: 'string', example: 'SW11 1AA' },
                  radius_km: { type: 'number', default: 5, minimum: 0.1, maximum: 25 },
                  grade: {
                    type: 'string',
                    enum: ['Outstanding', 'Good', 'Requires improvement', 'Inadequate'],
                    nullable: true,
                  },
                  funded_2yr: { type: 'boolean', default: false },
                  funded_3yr: { type: 'boolean', default: false },
                  page: { type: 'integer', default: 1 },
                  limit: { type: 'integer', default: 20, maximum: 50 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Paginated nursery search results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NurserySearchResult' },
              },
            },
          },
          400: { description: 'Invalid postcode or missing parameter' },
          404: { description: 'Postcode not found' },
        },
      },
    },
    '/api/v1/nurseries/{urn}': {
      get: {
        tags: ['nurseries'],
        summary: 'Get a single nursery by Ofsted URN',
        operationId: 'getNursery',
        parameters: [
          {
            in: 'path',
            name: 'urn',
            required: true,
            schema: { type: 'string' },
            description: 'Ofsted Unique Reference Number',
          },
        ],
        responses: {
          200: {
            description: 'Nursery record',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Nursery' } },
            },
          },
          404: { description: 'Nursery not found' },
        },
      },
    },
    '/api/v1/areas/{district}': {
      get: {
        tags: ['areas'],
        summary: 'Get area summary for a UK postcode district',
        operationId: 'getArea',
        parameters: [
          {
            in: 'path',
            name: 'district',
            required: true,
            schema: { type: 'string', example: 'SW11' },
          },
        ],
        responses: {
          200: {
            description: 'Area summary',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Area' } },
            },
          },
          404: { description: 'District not found' },
        },
      },
    },
    '/api/v1/areas/family-search': {
      get: {
        tags: ['areas'],
        summary: 'Find family-friendly areas near a postcode',
        operationId: 'familySearch',
        parameters: [
          { in: 'query', name: 'postcode', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'radius_km', schema: { type: 'number', default: 15 } },
          { in: 'query', name: 'min_family_score', schema: { type: 'number' } },
          { in: 'query', name: 'min_nursery_pct', schema: { type: 'number' } },
          {
            in: 'query',
            name: 'sort',
            schema: { type: 'string', enum: ['family_score', 'nursery_score', 'distance'] },
          },
        ],
        responses: {
          200: {
            description: 'Ranked list of nearby districts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Area' } },
                    meta: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/areas/{district}/nurseries': {
      get: {
        tags: ['areas'],
        summary: 'List all active nurseries inside a postcode district',
        operationId: 'getDistrictNurseries',
        parameters: [{ in: 'path', name: 'district', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Nurseries and aggregate stats',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    nurseries: { type: 'array', items: { $ref: '#/components/schemas/Nursery' } },
                    stats: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        outstanding: { type: 'integer' },
                        good: { type: 'integer' },
                        district: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/properties/districts': {
      get: {
        tags: ['properties'],
        summary: 'Browse postcode districts ranked by affordability + family score',
        operationId: 'browseDistricts',
        parameters: [
          { in: 'query', name: 'min_price', schema: { type: 'number' } },
          { in: 'query', name: 'max_price', schema: { type: 'number' } },
          {
            in: 'query',
            name: 'property_type',
            schema: { type: 'string', enum: ['all', 'flat', 'terraced', 'semi', 'detached'] },
          },
          { in: 'query', name: 'region', schema: { type: 'string' } },
          {
            in: 'query',
            name: 'sort',
            schema: { type: 'string', enum: ['price_asc', 'price_desc', 'family_score', 'yield'] },
          },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 60, maximum: 200 } },
        ],
        responses: {
          200: {
            description: 'Ranked districts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Area' } },
                    meta: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/overlays/schools/near': {
      get: {
        tags: ['overlays'],
        summary: 'Schools near a coordinate',
        operationId: 'schoolsNear',
        parameters: [
          { in: 'query', name: 'lat', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'lng', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'radius_km', schema: { type: 'number', default: 2 } },
        ],
        responses: {
          200: {
            description: 'Nearby schools',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { type: 'array', items: { type: 'object' } } },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/public/nursery/{urn}.md': {
      get: {
        tags: ['public-markdown'],
        summary: 'Markdown summary of a nursery (LLM-friendly)',
        operationId: 'nurseryMarkdown',
        parameters: [{ in: 'path', name: 'urn', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Markdown body',
            content: { 'text/markdown': { schema: { type: 'string' } } },
          },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/v1/public/area/{district}.md': {
      get: {
        tags: ['public-markdown'],
        summary: 'Markdown summary of a postcode district (LLM-friendly)',
        operationId: 'areaMarkdown',
        parameters: [{ in: 'path', name: 'district', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Markdown body',
            content: { 'text/markdown': { schema: { type: 'string' } } },
          },
          404: { description: 'Not found' },
        },
      },
    },
  },
  components: {
    schemas: {
      Nursery: {
        type: 'object',
        description: 'A UK nursery from the Ofsted Early Years register.',
        properties: {
          urn: { type: 'string', description: 'Ofsted Unique Reference Number' },
          name: { type: 'string' },
          provider_type: { type: 'string', nullable: true },
          address_line1: { type: 'string', nullable: true },
          town: { type: 'string', nullable: true },
          postcode: { type: 'string', nullable: true },
          local_authority: { type: 'string', nullable: true },
          ofsted_overall_grade: {
            type: 'string',
            enum: ['Outstanding', 'Good', 'Requires improvement', 'Inadequate'],
            nullable: true,
          },
          last_inspection_date: { type: 'string', format: 'date', nullable: true },
          inspection_report_url: { type: 'string', nullable: true },
          enforcement_notice: { type: 'boolean' },
          total_places: { type: 'integer', nullable: true },
          places_funded_2yr: { type: 'integer', nullable: true },
          places_funded_3_4yr: { type: 'integer', nullable: true },
          fee_avg_monthly: { type: 'number', nullable: true },
          lat: { type: 'number', nullable: true },
          lng: { type: 'number', nullable: true },
        },
      },
      Area: {
        type: 'object',
        description: 'A UK postcode district with family-relocation stats.',
        properties: {
          postcode_district: { type: 'string', example: 'SW11' },
          local_authority: { type: 'string', nullable: true },
          region: { type: 'string', nullable: true },
          family_score: { type: 'number', minimum: 0, maximum: 100, nullable: true },
          nursery_count_total: { type: 'integer', nullable: true },
          nursery_count_outstanding: { type: 'integer', nullable: true },
          nursery_outstanding_pct: { type: 'number', nullable: true },
          avg_sale_price_all: { type: 'number', nullable: true },
          crime_rate_per_1000: { type: 'number', nullable: true },
          imd_decile: { type: 'integer', nullable: true },
          flood_risk_level: { type: 'string', nullable: true },
          lat: { type: 'number', nullable: true },
          lng: { type: 'number', nullable: true },
        },
      },
      NurserySearchResult: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Nursery' } },
          meta: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              page: { type: 'integer' },
              limit: { type: 'integer' },
              pages: { type: 'integer' },
              search_lat: { type: 'number' },
              search_lng: { type: 'number' },
            },
          },
        },
      },
    },
  },
}

export default openapi
