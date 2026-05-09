const bearerAuth = { bearerAuth: [] }
const paginationParams = [
  { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
  { in: 'query', name: 'limit', schema: { type: 'integer', default: 20, maximum: 100 } },
]
const paginatedResponse = (itemRef) => ({
  200: {
    description: 'Paginated list',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: `#/components/schemas/${itemRef}` } },
            meta: { $ref: '#/components/schemas/PaginationMeta' },
          },
        },
      },
    },
  },
})
const jsonOk = (desc, schemaOrRef) => ({
  200: {
    description: desc,
    content: { 'application/json': { schema: typeof schemaOrRef === 'string' ? { $ref: `#/components/schemas/${schemaOrRef}` } : schemaOrRef } },
  },
})
const urnParam = { in: 'path', name: 'urn', required: true, schema: { type: 'string' }, description: 'Ofsted URN' }

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'CompareTheNursery Public API',
    version: '1.0.0',
    description:
      'Full API for CompareTheNursery — UK nursery comparison, area intelligence, property data, provider management, and admin dashboard. Public endpoints are free and keyless. Authenticated endpoints require a Supabase JWT bearer token. Source data: Ofsted Early Years register (OGL v3.0), HM Land Registry, ONS, data.police.uk, Environment Agency.',
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    contact: { name: 'CompareTheNursery', url: 'https://comparethenursery.com' },
  },
  servers: [{ url: 'https://nursery-finder-6u7r.onrender.com', description: 'Production' }],
  tags: [
    { name: 'Nurseries', description: 'Search, lookup, compare, and autocomplete nurseries' },
    { name: 'Areas', description: 'Postcode-district family scores, stats, and nursery lists' },
    { name: 'Properties', description: 'Land Registry property data and district browser' },
    { name: 'Overlays', description: 'Schools and geo overlays' },
    { name: 'Markdown', description: 'LLM-friendly markdown summaries' },
    { name: 'Reviews', description: 'Nursery parent reviews' },
    { name: 'Q&A', description: 'Nursery questions and answers' },
    { name: 'Profile', description: 'User profile management' },
    { name: 'Enquiries', description: 'Parent enquiries to nurseries' },
    { name: 'Visits', description: 'Visit booking slots and bookings' },
    { name: 'Claims', description: 'Nursery ownership claims' },
    { name: 'Saved Searches', description: 'Saved search CRUD and alerts' },
    { name: 'Notifications', description: 'In-app notifications' },
    { name: 'Quiz', description: 'Decision engine quiz and recommendations' },
    { name: 'Email', description: 'Email shortlist/comparison to self' },
    { name: 'Travel', description: 'OSRM travel time and isochrone' },
    { name: 'AI', description: 'Claude-powered summaries, synthesis, and assistant' },
    { name: 'Blog', description: 'Guides and blog content' },
    { name: 'Provider', description: 'Provider nursery management, photos, fees, availability, staff' },
    { name: 'Provider Analytics', description: 'Provider dashboard analytics and reports' },
    { name: 'Provider Enquiries', description: 'Provider enquiry management' },
    { name: 'Provider Slots', description: 'Provider visit slot management' },
    { name: 'Billing', description: 'Stripe subscription and checkout' },
    { name: 'Admin', description: 'Admin dashboard — stats, users, claims, reviews, enquiries, bookings' },
    { name: 'Admin Invites', description: 'Provider acquisition outreach' },
    { name: 'Admin Promotions', description: 'Promoted nursery management' },
    { name: 'Promotions', description: 'Public promoted nursery matching' },
    { name: 'Ingest', description: 'Data ingestion pipelines (admin-only)' },
    { name: 'Health', description: 'Health check' },
  ],
  paths: {
    // ── Health ──────────────────────────────────────────────
    '/api/v1/health': {
      get: { tags: ['Health'], summary: 'Health check', operationId: 'healthCheck', responses: jsonOk('Health status', { type: 'object', properties: { status: { type: 'string' } } }) },
    },

    // ── Nurseries ──────────────────────────────────────────
    '/api/v1/nurseries/search': {
      post: {
        tags: ['Nurseries'], summary: 'Search nurseries near a UK postcode', operationId: 'searchNurseries',
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['postcode'],
          properties: {
            postcode: { type: 'string', example: 'SW11 1AA' },
            radius_km: { type: 'number', default: 5, minimum: 0.1, maximum: 25 },
            grade: { type: 'string', enum: ['Outstanding', 'Good', 'Requires improvement', 'Inadequate'], nullable: true },
            funded_2yr: { type: 'boolean', default: false },
            funded_3yr: { type: 'boolean', default: false },
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20, maximum: 50 },
          },
        } } } },
        responses: { ...jsonOk('Paginated search results', 'NurserySearchResult'), 400: { description: 'Invalid postcode' }, 404: { description: 'Postcode not found' } },
      },
    },
    '/api/v1/nurseries/smart-search': {
      post: {
        tags: ['Nurseries'], summary: 'Smart search with natural language query', operationId: 'smartSearchNurseries',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string' }, postcode: { type: 'string' }, radius_km: { type: 'number' } } } } } },
        responses: jsonOk('Smart search results', { type: 'object' }),
      },
    },
    '/api/v1/nurseries/compare': {
      post: {
        tags: ['Nurseries'], summary: 'Compare multiple nurseries side by side', operationId: 'compareNurseries',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['urns'], properties: { urns: { type: 'array', items: { type: 'string' }, maxItems: 5 } } } } } },
        responses: jsonOk('Comparison data', { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Nursery' } } } }),
      },
    },
    '/api/v1/nurseries/fees': {
      post: {
        tags: ['Nurseries'], summary: 'Get fees for multiple nurseries', operationId: 'getNurseryFees',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { urns: { type: 'array', items: { type: 'string' } } } } } } },
        responses: jsonOk('Fees data', { type: 'object' }),
      },
    },
    '/api/v1/nurseries/autocomplete': {
      get: {
        tags: ['Nurseries'], summary: 'Autocomplete nursery names', operationId: 'autocompleteNurseries',
        parameters: [{ in: 'query', name: 'q', required: true, schema: { type: 'string' } }, { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } }],
        responses: jsonOk('Suggestions', { type: 'object', properties: { data: { type: 'array', items: { type: 'object' } } } }),
      },
    },
    '/api/v1/nurseries/towns': {
      get: { tags: ['Nurseries'], summary: 'List all towns with nurseries', operationId: 'listTowns', responses: jsonOk('Town list', { type: 'object' }) },
    },
    '/api/v1/nurseries/by-town/{town}': {
      get: {
        tags: ['Nurseries'], summary: 'List nurseries in a town', operationId: 'nurseryByTown',
        parameters: [{ in: 'path', name: 'town', required: true, schema: { type: 'string' } }],
        responses: jsonOk('Nurseries in town', { type: 'object' }),
      },
    },
    '/api/v1/nurseries/{urn}': {
      get: {
        tags: ['Nurseries'], summary: 'Get a single nursery by Ofsted URN', operationId: 'getNursery',
        parameters: [urnParam],
        responses: { ...jsonOk('Nursery record', 'Nursery'), 404: { description: 'Not found' } },
      },
    },
    '/api/v1/nurseries/{urn}/similar': {
      get: {
        tags: ['Nurseries'], summary: 'Get similar nurseries', operationId: 'similarNurseries',
        parameters: [urnParam, { in: 'query', name: 'limit', schema: { type: 'integer', default: 5 } }],
        responses: jsonOk('Similar nurseries', { type: 'object' }),
      },
    },
    '/api/v1/nurseries/{urn}/availability': {
      get: {
        tags: ['Nurseries'], summary: 'Get nursery availability', operationId: 'getNurseryAvailability',
        parameters: [urnParam],
        responses: jsonOk('Availability', { type: 'object' }),
      },
    },
    '/api/v1/nurseries/{urn}/view': {
      post: {
        tags: ['Provider Analytics'], summary: 'Record a nursery page view', operationId: 'recordNurseryView',
        parameters: [urnParam],
        responses: { 204: { description: 'Recorded' } },
      },
    },

    // ── Reviews ────────────────────────────────────────────
    '/api/v1/nurseries/{urn}/reviews': {
      get: {
        tags: ['Reviews'], summary: 'List reviews for a nursery', operationId: 'listReviews',
        parameters: [urnParam, ...paginationParams],
        responses: jsonOk('Reviews list', { type: 'object' }),
      },
      post: {
        tags: ['Reviews'], summary: 'Submit a review', operationId: 'submitReview',
        security: [bearerAuth],
        parameters: [urnParam],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['rating'], properties: { rating: { type: 'integer', minimum: 1, maximum: 5 }, title: { type: 'string' }, body: { type: 'string' }, author_display_name: { type: 'string' } } } } } },
        responses: { 201: { description: 'Review created' }, 401: { description: 'Auth required' } },
      },
    },

    // ── Q&A ────────────────────────────────────────────────
    '/api/v1/nurseries/{urn}/questions': {
      get: {
        tags: ['Q&A'], summary: 'List questions for a nursery', operationId: 'listQuestions',
        parameters: [urnParam],
        responses: jsonOk('Questions', { type: 'object' }),
      },
      post: {
        tags: ['Q&A'], summary: 'Ask a question about a nursery', operationId: 'askQuestion',
        security: [bearerAuth], parameters: [urnParam],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['body'], properties: { body: { type: 'string' } } } } } },
        responses: { 201: { description: 'Question created' } },
      },
    },
    '/api/v1/nurseries/{urn}/questions/{questionId}/answers': {
      post: {
        tags: ['Q&A'], summary: 'Answer a question', operationId: 'answerQuestion',
        security: [bearerAuth],
        parameters: [urnParam, { in: 'path', name: 'questionId', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['body'], properties: { body: { type: 'string' } } } } } },
        responses: { 201: { description: 'Answer created' } },
      },
    },

    // ── Areas ──────────────────────────────────────────────
    '/api/v1/areas/{district}': {
      get: {
        tags: ['Areas'], summary: 'Get area summary for a postcode district', operationId: 'getArea',
        parameters: [{ in: 'path', name: 'district', required: true, schema: { type: 'string', example: 'SW11' } }],
        responses: { ...jsonOk('Area summary', 'Area'), 404: { description: 'Not found' } },
      },
    },
    '/api/v1/areas/family-search': {
      get: {
        tags: ['Areas'], summary: 'Find family-friendly areas near a postcode', operationId: 'familySearch',
        parameters: [
          { in: 'query', name: 'postcode', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'radius_km', schema: { type: 'number', default: 15 } },
          { in: 'query', name: 'min_family_score', schema: { type: 'number' } },
          { in: 'query', name: 'min_nursery_pct', schema: { type: 'number' } },
          { in: 'query', name: 'sort', schema: { type: 'string', enum: ['family_score', 'nursery_score', 'distance'] } },
        ],
        responses: jsonOk('Ranked districts', { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Area' } }, meta: { type: 'object' } } }),
      },
    },
    '/api/v1/areas/{district}/nurseries': {
      get: {
        tags: ['Areas'], summary: 'List nurseries in a district', operationId: 'getDistrictNurseries',
        parameters: [{ in: 'path', name: 'district', required: true, schema: { type: 'string' } }],
        responses: jsonOk('Nurseries and stats', { type: 'object' }),
      },
    },

    // ── Properties ─────────────────────────────────────────
    '/api/v1/properties/search': {
      get: {
        tags: ['Properties'], summary: 'Search properties by postcode', operationId: 'searchProperties',
        parameters: [{ in: 'query', name: 'postcode', required: true, schema: { type: 'string' } }, { in: 'query', name: 'radius_km', schema: { type: 'number' } }],
        responses: jsonOk('Property results', { type: 'object' }),
      },
    },
    '/api/v1/properties/districts': {
      get: {
        tags: ['Properties'], summary: 'Browse districts by affordability and family score', operationId: 'browseDistricts',
        parameters: [
          { in: 'query', name: 'min_price', schema: { type: 'number' } },
          { in: 'query', name: 'max_price', schema: { type: 'number' } },
          { in: 'query', name: 'property_type', schema: { type: 'string', enum: ['all', 'flat', 'terraced', 'semi', 'detached'] } },
          { in: 'query', name: 'region', schema: { type: 'string' } },
          { in: 'query', name: 'sort', schema: { type: 'string', enum: ['price_asc', 'price_desc', 'family_score', 'yield'] } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 60, maximum: 200 } },
        ],
        responses: jsonOk('Ranked districts', { type: 'object' }),
      },
    },

    // ── Overlays ───────────────────────────────────────────
    '/api/v1/overlays/schools/near': {
      get: {
        tags: ['Overlays'], summary: 'Schools near a coordinate', operationId: 'schoolsNear',
        parameters: [
          { in: 'query', name: 'lat', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'lng', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'radius_km', schema: { type: 'number', default: 2 } },
        ],
        responses: jsonOk('Nearby schools', { type: 'object' }),
      },
    },
    '/api/v1/schools/near': {
      get: {
        tags: ['Overlays'], summary: 'Schools near a coordinate (alias)', operationId: 'schoolsNearAlias',
        parameters: [
          { in: 'query', name: 'lat', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'lng', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'radius_km', schema: { type: 'number', default: 2 } },
        ],
        responses: jsonOk('Nearby schools', { type: 'object' }),
      },
    },
    '/api/v1/schools/{urn}': {
      get: {
        tags: ['Overlays'], summary: 'Get a school by URN', operationId: 'getSchool',
        parameters: [{ in: 'path', name: 'urn', required: true, schema: { type: 'string' } }],
        responses: jsonOk('School record', { type: 'object' }),
      },
    },

    // ── Markdown ───────────────────────────────────────────
    '/api/v1/public/nursery/{urn}.md': {
      get: {
        tags: ['Markdown'], summary: 'Markdown summary of a nursery (LLM-friendly)', operationId: 'nurseryMarkdown',
        parameters: [urnParam],
        responses: { 200: { description: 'Markdown', content: { 'text/markdown': { schema: { type: 'string' } } } }, 404: { description: 'Not found' } },
      },
    },
    '/api/v1/public/area/{district}.md': {
      get: {
        tags: ['Markdown'], summary: 'Markdown summary of a postcode district', operationId: 'areaMarkdown',
        parameters: [{ in: 'path', name: 'district', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Markdown', content: { 'text/markdown': { schema: { type: 'string' } } } }, 404: { description: 'Not found' } },
      },
    },

    // ── Blog ───────────────────────────────────────────────
    '/api/v1/blog': {
      get: { tags: ['Blog'], summary: 'List blog/guide posts', operationId: 'listBlogPosts', responses: jsonOk('Posts', { type: 'object' }) },
    },
    '/api/v1/blog/{slug}': {
      get: {
        tags: ['Blog'], summary: 'Get a blog post by slug', operationId: 'getBlogPost',
        parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string' } }],
        responses: { ...jsonOk('Post', { type: 'object' }), 404: { description: 'Not found' } },
      },
    },

    // ── Profile ────────────────────────────────────────────
    '/api/v1/profile': {
      get: {
        tags: ['Profile'], summary: 'Get current user profile', operationId: 'getProfile',
        security: [bearerAuth],
        responses: { ...jsonOk('Profile', 'Profile'), 401: { description: 'Auth required' } },
      },
      patch: {
        tags: ['Profile'], summary: 'Update current user profile', operationId: 'updateProfile',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileUpdate' } } } },
        responses: jsonOk('Updated profile', 'Profile'),
      },
    },
    '/api/v1/profile/export': {
      get: {
        tags: ['Profile'], summary: 'Export all user data (GDPR)', operationId: 'exportData',
        security: [bearerAuth],
        responses: jsonOk('Full data export', { type: 'object' }),
      },
    },
    '/api/v1/profile/notification-preferences': {
      get: {
        tags: ['Profile'], summary: 'Get notification preferences', operationId: 'getNotifPrefs',
        security: [bearerAuth],
        responses: jsonOk('Preferences', { type: 'object' }),
      },
      patch: {
        tags: ['Profile'], summary: 'Update notification preferences', operationId: 'updateNotifPrefs',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Updated preferences', { type: 'object' }),
      },
    },

    // ── Enquiries ──────────────────────────────────────────
    '/api/v1/enquiries': {
      post: {
        tags: ['Enquiries'], summary: 'Submit enquiries to nurseries', operationId: 'submitEnquiries',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['nursery_ids'],
          properties: {
            nursery_ids: { type: 'array', items: { type: 'string' }, maxItems: 10 },
            child_name: { type: 'string', nullable: true },
            child_dob: { type: 'string', format: 'date', nullable: true },
            preferred_start: { type: 'string', format: 'date', nullable: true },
            session_preference: { type: 'string', enum: ['full_day', 'half_day_am', 'half_day_pm', 'flexible'], nullable: true },
            message: { type: 'string', nullable: true },
          },
        } } } },
        responses: { 201: { description: 'Enquiries created (some may be queued for unclaimed nurseries)' }, 400: { description: 'Validation error' }, 429: { description: 'Rate limited (10/hour)' } },
      },
    },
    '/api/v1/enquiries/mine': {
      get: {
        tags: ['Enquiries'], summary: 'List my enquiries', operationId: 'myEnquiries',
        security: [bearerAuth],
        responses: jsonOk('Enquiry list', { type: 'object' }),
      },
    },
    '/api/v1/enquiries/{enquiryId}/messages': {
      get: {
        tags: ['Enquiries'], summary: 'Get messages for an enquiry thread', operationId: 'getEnquiryMessages',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'enquiryId', required: true, schema: { type: 'string' } }],
        responses: jsonOk('Messages', { type: 'object' }),
      },
      post: {
        tags: ['Enquiries'], summary: 'Send a message in an enquiry thread', operationId: 'sendEnquiryMessage',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'enquiryId', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['body'], properties: { body: { type: 'string' } } } } } },
        responses: { 201: { description: 'Message sent' } },
      },
    },
    '/api/v1/enquiries/{enquiryId}/messages/read': {
      patch: {
        tags: ['Enquiries'], summary: 'Mark messages as read', operationId: 'markMessagesRead',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'enquiryId', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Marked' } },
      },
    },

    // ── Visits ─────────────────────────────────────────────
    '/api/v1/visits/slots/{urn}': {
      get: {
        tags: ['Visits'], summary: 'Get available visit slots for a nursery', operationId: 'getVisitSlots',
        parameters: [urnParam],
        responses: jsonOk('Slots', { type: 'object' }),
      },
    },
    '/api/v1/visits/book': {
      post: {
        tags: ['Visits'], summary: 'Book a visit slot', operationId: 'bookVisit',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['slot_id'], properties: { slot_id: { type: 'string' }, notes: { type: 'string' } } } } } },
        responses: { 201: { description: 'Booking created' } },
      },
    },
    '/api/v1/visits/mine': {
      get: {
        tags: ['Visits'], summary: 'List my visit bookings', operationId: 'myVisits',
        security: [bearerAuth],
        responses: jsonOk('Bookings', { type: 'object' }),
      },
    },
    '/api/v1/visits/{id}': {
      delete: {
        tags: ['Visits'], summary: 'Cancel a visit booking', operationId: 'cancelVisit',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Cancelled' } },
      },
    },
    '/api/v1/visits/{id}/survey': {
      post: {
        tags: ['Visits'], summary: 'Submit post-visit survey', operationId: 'submitVisitSurvey',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Survey submitted' } },
      },
    },

    // ── Claims ─────────────────────────────────────────────
    '/api/v1/claims': {
      post: {
        tags: ['Claims'], summary: 'Submit a nursery claim', operationId: 'submitClaim',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['urn'], properties: { urn: { type: 'string' }, claimer_name: { type: 'string' }, claimer_role: { type: 'string' }, evidence_notes: { type: 'string' } } } } } },
        responses: { 201: { description: 'Claim submitted' } },
      },
      get: {
        tags: ['Claims'], summary: 'List all claims (public summary)', operationId: 'listClaims',
        responses: jsonOk('Claims list', { type: 'object' }),
      },
    },
    '/api/v1/claims/mine': {
      get: {
        tags: ['Claims'], summary: 'List my claims', operationId: 'myClaims',
        security: [bearerAuth],
        responses: jsonOk('My claims', { type: 'object' }),
      },
    },

    // ── Saved Searches ─────────────────────────────────────
    '/api/v1/saved-searches': {
      get: {
        tags: ['Saved Searches'], summary: 'List my saved searches', operationId: 'listSavedSearches',
        security: [bearerAuth],
        responses: jsonOk('Saved searches', { type: 'object' }),
      },
      post: {
        tags: ['Saved Searches'], summary: 'Create a saved search', operationId: 'createSavedSearch',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['postcode', 'radius_km'], properties: { postcode: { type: 'string' }, radius_km: { type: 'number' }, name: { type: 'string' }, grade_filter: { type: 'string' }, funded_2yr: { type: 'boolean' }, funded_3yr: { type: 'boolean' }, alert_on_new: { type: 'boolean' } } } } } },
        responses: { 201: { description: 'Created' } },
      },
    },
    '/api/v1/saved-searches/{id}': {
      patch: {
        tags: ['Saved Searches'], summary: 'Update a saved search', operationId: 'updateSavedSearch',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Updated', { type: 'object' }),
      },
      delete: {
        tags: ['Saved Searches'], summary: 'Delete a saved search', operationId: 'deleteSavedSearch',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ── Notifications ──────────────────────────────────────
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'], summary: 'List recent notifications', operationId: 'listNotifications',
        security: [bearerAuth],
        parameters: [{ in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } }],
        responses: jsonOk('Notifications', { type: 'object' }),
      },
    },
    '/api/v1/notifications/unread-count': {
      get: {
        tags: ['Notifications'], summary: 'Get unread notification count', operationId: 'unreadCount',
        security: [bearerAuth],
        responses: jsonOk('Count', { type: 'object', properties: { count: { type: 'integer' } } }),
      },
    },
    '/api/v1/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'], summary: 'Mark a notification as read', operationId: 'markRead',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Marked' } },
      },
    },
    '/api/v1/notifications/read-all': {
      patch: {
        tags: ['Notifications'], summary: 'Mark all notifications as read', operationId: 'markAllRead',
        security: [bearerAuth],
        responses: { 200: { description: 'All marked' } },
      },
    },

    // ── Quiz ───────────────────────────────────────────────
    '/api/v1/quiz/submit': {
      post: {
        tags: ['Quiz'], summary: 'Submit quiz answers', operationId: 'submitQuiz',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Submitted' } },
      },
    },
    '/api/v1/quiz/mine': {
      get: {
        tags: ['Quiz'], summary: 'Get my quiz submissions', operationId: 'myQuiz',
        security: [bearerAuth],
        responses: jsonOk('Quiz data', { type: 'object' }),
      },
    },
    '/api/v1/recommendations': {
      get: {
        tags: ['Quiz'], summary: 'Get nursery recommendations based on quiz', operationId: 'getRecommendations',
        security: [bearerAuth],
        responses: jsonOk('Recommendations', { type: 'object' }),
      },
    },
    '/api/v1/recommendations/tradeoffs': {
      get: {
        tags: ['Quiz'], summary: 'Get recommendation tradeoffs', operationId: 'getTradeoffs',
        security: [bearerAuth],
        responses: jsonOk('Tradeoffs', { type: 'object' }),
      },
    },

    // ── Email ──────────────────────────────────────────────
    '/api/v1/email/shortlist': {
      post: {
        tags: ['Email'], summary: 'Email shortlist to self', operationId: 'emailShortlist',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Sent' } },
      },
    },
    '/api/v1/email/comparison': {
      post: {
        tags: ['Email'], summary: 'Email comparison to self', operationId: 'emailComparison',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Sent' } },
      },
    },

    // ── Travel ─────────────────────────────────────────────
    '/api/v1/travel/time': {
      post: {
        tags: ['Travel'], summary: 'Calculate travel time between two points', operationId: 'travelTime',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['from', 'to'], properties: { from: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } }, to: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } } } } } } },
        responses: jsonOk('Travel time', { type: 'object', properties: { duration_seconds: { type: 'number' }, distance_metres: { type: 'number' } } }),
      },
    },
    '/api/v1/travel/isochrone': {
      post: {
        tags: ['Travel'], summary: 'Generate isochrone polygon', operationId: 'isochrone',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['lat', 'lng', 'minutes'], properties: { lat: { type: 'number' }, lng: { type: 'number' }, minutes: { type: 'integer' } } } } } },
        responses: jsonOk('GeoJSON polygon', { type: 'object' }),
      },
    },

    // ── AI ──────────────────────────────────────────────────
    '/api/v1/nurseries/{urn}/summary': {
      get: {
        tags: ['AI'], summary: 'AI-generated nursery summary', operationId: 'aiNurserySummary',
        parameters: [urnParam],
        responses: jsonOk('AI summary', { type: 'object', properties: { summary: { type: 'string' } } }),
      },
    },
    '/api/v1/nurseries/{urn}/review-synthesis': {
      get: {
        tags: ['AI'], summary: 'AI synthesis of nursery reviews', operationId: 'aiReviewSynthesis',
        parameters: [urnParam],
        responses: jsonOk('Review synthesis', { type: 'object' }),
      },
    },
    '/api/v1/ai/match-narrative': {
      post: {
        tags: ['AI'], summary: 'AI narrative matching nurseries to preferences', operationId: 'aiMatchNarrative',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Narrative', { type: 'object' }),
      },
    },
    '/api/v1/ai/conversational-search': {
      post: {
        tags: ['AI'], summary: 'AI conversational nursery search', operationId: 'aiConversationalSearch',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' }, history: { type: 'array', items: { type: 'object' } } } } } } },
        responses: jsonOk('AI response', { type: 'object' }),
      },
    },
    '/api/v1/assistant/chat': {
      post: {
        tags: ['AI'], summary: 'AI move assistant chat', operationId: 'assistantChat',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' }, history: { type: 'array', items: { type: 'object' } } } } } } },
        responses: jsonOk('Assistant response', { type: 'object' }),
      },
    },
    '/api/v1/assistant/search': {
      post: {
        tags: ['AI'], summary: 'AI-powered search with context', operationId: 'assistantSearch',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Search results', { type: 'object' }),
      },
    },

    // ── Provider ───────────────────────────────────────────
    '/api/v1/provider/nurseries': {
      get: {
        tags: ['Provider'], summary: 'List provider\'s claimed nurseries', operationId: 'providerNurseries',
        security: [bearerAuth],
        responses: jsonOk('Nurseries', { type: 'object' }),
      },
    },
    '/api/v1/provider/features': {
      get: {
        tags: ['Provider'], summary: 'Get provider feature flags by tier', operationId: 'providerFeatures',
        security: [bearerAuth],
        responses: jsonOk('Features', { type: 'object' }),
      },
    },
    '/api/v1/provider/nurseries/{urn}': {
      patch: {
        tags: ['Provider'], summary: 'Update nursery details', operationId: 'updateProviderNursery',
        security: [bearerAuth], parameters: [urnParam],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Updated nursery', { type: 'object' }),
      },
    },
    '/api/v1/provider/nurseries/{urn}/photos': {
      get: {
        tags: ['Provider'], summary: 'List nursery photos', operationId: 'listProviderPhotos',
        security: [bearerAuth], parameters: [urnParam],
        responses: jsonOk('Photos', { type: 'object' }),
      },
      post: {
        tags: ['Provider'], summary: 'Upload a nursery photo', operationId: 'uploadProviderPhoto',
        security: [bearerAuth], parameters: [urnParam],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { image_base64: { type: 'string' }, caption: { type: 'string' } } } } } },
        responses: { 201: { description: 'Photo uploaded' } },
      },
    },
    '/api/v1/provider/nurseries/{urn}/photos/{photoId}': {
      delete: {
        tags: ['Provider'], summary: 'Delete a nursery photo', operationId: 'deleteProviderPhoto',
        security: [bearerAuth],
        parameters: [urnParam, { in: 'path', name: 'photoId', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/api/v1/provider/nurseries/{urn}/fees': {
      get: {
        tags: ['Provider'], summary: 'List nursery fees', operationId: 'listProviderFees',
        security: [bearerAuth], parameters: [urnParam],
        responses: jsonOk('Fees', { type: 'object' }),
      },
      post: {
        tags: ['Provider'], summary: 'Add a fee entry', operationId: 'addProviderFee',
        security: [bearerAuth], parameters: [urnParam],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Fee added' } },
      },
    },
    '/api/v1/provider/nurseries/{urn}/fees/{feeId}': {
      patch: {
        tags: ['Provider'], summary: 'Update a fee entry', operationId: 'updateProviderFee',
        security: [bearerAuth],
        parameters: [urnParam, { in: 'path', name: 'feeId', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Updated', { type: 'object' }),
      },
      delete: {
        tags: ['Provider'], summary: 'Delete a fee entry', operationId: 'deleteProviderFee',
        security: [bearerAuth],
        parameters: [urnParam, { in: 'path', name: 'feeId', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/api/v1/provider/nurseries/{urn}/availability': {
      get: {
        tags: ['Provider'], summary: 'Get nursery availability settings', operationId: 'getProviderAvailability',
        security: [bearerAuth], parameters: [urnParam],
        responses: jsonOk('Availability', { type: 'object' }),
      },
      put: {
        tags: ['Provider'], summary: 'Set nursery availability', operationId: 'setProviderAvailability',
        security: [bearerAuth], parameters: [urnParam],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Updated', { type: 'object' }),
      },
    },
    '/api/v1/provider/nurseries/{urn}/pricing': {
      get: {
        tags: ['Provider'], summary: 'Get nursery pricing data', operationId: 'getProviderPricing',
        security: [bearerAuth], parameters: [urnParam],
        responses: jsonOk('Pricing', { type: 'object' }),
      },
      post: {
        tags: ['Provider'], summary: 'Set nursery pricing', operationId: 'setProviderPricing',
        security: [bearerAuth], parameters: [urnParam],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Updated', { type: 'object' }),
      },
    },
    '/api/v1/provider/nurseries/{urn}/staff': {
      post: {
        tags: ['Provider'], summary: 'Update staff information', operationId: 'updateProviderStaff',
        security: [bearerAuth], parameters: [urnParam],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Updated', { type: 'object' }),
      },
    },
    '/api/v1/provider/nurseries/{urn}/slots': {
      get: {
        tags: ['Provider Slots'], summary: 'List visit slots for a nursery', operationId: 'listProviderSlots',
        security: [bearerAuth], parameters: [urnParam],
        responses: jsonOk('Slots', { type: 'object' }),
      },
      post: {
        tags: ['Provider Slots'], summary: 'Create visit slots', operationId: 'createProviderSlots',
        security: [bearerAuth], parameters: [urnParam],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Slots created' } },
      },
    },
    '/api/v1/provider/nurseries/{urn}/slots/{id}': {
      delete: {
        tags: ['Provider Slots'], summary: 'Delete a visit slot', operationId: 'deleteProviderSlot',
        security: [bearerAuth],
        parameters: [urnParam, { in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ── Provider Enquiries ─────────────────────────────────
    '/api/v1/provider/enquiries': {
      get: {
        tags: ['Provider Enquiries'], summary: 'List enquiries received by provider', operationId: 'listProviderEnquiries',
        security: [bearerAuth],
        responses: jsonOk('Enquiries', { type: 'object' }),
      },
    },
    '/api/v1/provider/enquiries/{id}': {
      patch: {
        tags: ['Provider Enquiries'], summary: 'Update enquiry status', operationId: 'updateProviderEnquiry',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } } },
        responses: jsonOk('Updated', { type: 'object' }),
      },
    },

    // ── Provider Analytics ─────────────────────────────────
    '/api/v1/provider/analytics': {
      get: {
        tags: ['Provider Analytics'], summary: 'Get provider analytics dashboard data', operationId: 'providerAnalytics',
        security: [bearerAuth],
        responses: jsonOk('Analytics', { type: 'object' }),
      },
    },
    '/api/v1/provider/reports': {
      get: {
        tags: ['Provider Analytics'], summary: 'Get provider reports', operationId: 'providerReports',
        security: [bearerAuth],
        responses: jsonOk('Reports', { type: 'object' }),
      },
    },
    '/api/v1/provider/reports/export': {
      get: {
        tags: ['Provider Analytics'], summary: 'Export provider reports as CSV', operationId: 'providerReportsExport',
        security: [bearerAuth],
        responses: { 200: { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string' } } } } },
      },
    },

    // ── Provider Auth ──────────────────────────────────────
    '/api/v1/provider-auth/register': {
      post: {
        tags: ['Provider'], summary: 'Register as a provider (combined signup + claim)', operationId: 'providerRegister',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'urn'], properties: { email: { type: 'string' }, urn: { type: 'string' }, claimer_name: { type: 'string' }, claimer_role: { type: 'string' } } } } } },
        responses: { 201: { description: 'Provider registered' } },
      },
    },

    // ── Billing ────────────────────────────────────────────
    '/api/v1/billing/tiers': {
      get: {
        tags: ['Billing'], summary: 'Get available subscription tiers and pricing', operationId: 'billingTiers',
        responses: jsonOk('Tiers', { type: 'object' }),
      },
    },
    '/api/v1/billing/subscription': {
      get: {
        tags: ['Billing'], summary: 'Get current subscription status', operationId: 'billingSubscription',
        security: [bearerAuth],
        responses: jsonOk('Subscription', { type: 'object' }),
      },
    },
    '/api/v1/billing/checkout': {
      post: {
        tags: ['Billing'], summary: 'Create Stripe checkout session', operationId: 'billingCheckout',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['tier'], properties: { tier: { type: 'string', enum: ['pro', 'premium'] }, type: { type: 'string', enum: ['provider', 'parent'] } } } } } },
        responses: jsonOk('Checkout URL', { type: 'object', properties: { url: { type: 'string' } } }),
      },
    },
    '/api/v1/billing/portal': {
      post: {
        tags: ['Billing'], summary: 'Create Stripe customer portal session', operationId: 'billingPortal',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string', enum: ['provider', 'parent'] } } } } } },
        responses: jsonOk('Portal URL', { type: 'object', properties: { url: { type: 'string' } } }),
      },
    },

    // ── Promotions ─────────────────────────────────────────
    '/api/v1/promotions/nearby': {
      get: {
        tags: ['Promotions'], summary: 'Get promoted nurseries near a location', operationId: 'nearbyPromotions',
        parameters: [
          { in: 'query', name: 'lat', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'lng', required: true, schema: { type: 'number' } },
          { in: 'query', name: 'radius_km', schema: { type: 'number', default: 5 } },
        ],
        responses: jsonOk('Promotions', { type: 'object' }),
      },
    },
    '/api/v1/promotions/{id}/impression': {
      post: {
        tags: ['Promotions'], summary: 'Record a promotion impression', operationId: 'promotionImpression',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Recorded' } },
      },
    },
    '/api/v1/promotions/{id}/click': {
      post: {
        tags: ['Promotions'], summary: 'Record a promotion click', operationId: 'promotionClick',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Recorded' } },
      },
    },

    // ── Admin ──────────────────────────────────────────────
    '/api/v1/admin/stats': {
      get: {
        tags: ['Admin'], summary: 'Dashboard summary stats', operationId: 'adminStats',
        security: [bearerAuth],
        responses: jsonOk('Stats', { type: 'object' }),
      },
    },
    '/api/v1/admin/stats/growth': {
      get: {
        tags: ['Admin'], summary: 'Growth metrics (week + month)', operationId: 'adminGrowth',
        security: [bearerAuth],
        responses: jsonOk('Growth', { type: 'object' }),
      },
    },
    '/api/v1/admin/stats/data-quality': {
      get: {
        tags: ['Admin'], summary: 'Data quality warnings', operationId: 'adminDataQuality',
        security: [bearerAuth],
        responses: jsonOk('Quality', { type: 'object' }),
      },
    },
    '/api/v1/admin/analytics': {
      get: {
        tags: ['Admin'], summary: 'Enhanced analytics dashboard', operationId: 'adminAnalytics',
        security: [bearerAuth],
        responses: jsonOk('Analytics', { type: 'object' }),
      },
    },
    '/api/v1/admin/activity': {
      get: {
        tags: ['Admin'], summary: 'Recent activity feed', operationId: 'adminActivity',
        security: [bearerAuth],
        parameters: [{ in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } }],
        responses: jsonOk('Activity items', { type: 'object' }),
      },
    },
    '/api/v1/admin/users': {
      get: {
        tags: ['Admin'], summary: 'List users (paginated)', operationId: 'adminListUsers',
        security: [bearerAuth],
        parameters: [...paginationParams, { in: 'query', name: 'role', schema: { type: 'string', enum: ['customer', 'provider', 'admin'] } }, { in: 'query', name: 'search', schema: { type: 'string' } }],
        responses: paginatedResponse('AdminUser'),
      },
    },
    '/api/v1/admin/users/{id}/role': {
      patch: {
        tags: ['Admin'], summary: 'Update user role', operationId: 'adminUpdateRole',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['customer', 'provider', 'admin'] } } } } } },
        responses: jsonOk('Updated user', { type: 'object' }),
      },
    },
    '/api/v1/admin/claims': {
      get: {
        tags: ['Admin'], summary: 'List claims (paginated)', operationId: 'adminListClaims',
        security: [bearerAuth],
        parameters: [...paginationParams, { in: 'query', name: 'status', schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] } }],
        responses: paginatedResponse('AdminClaim'),
      },
    },
    '/api/v1/admin/claims/{id}': {
      patch: {
        tags: ['Admin'], summary: 'Approve or reject a claim', operationId: 'adminUpdateClaim',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['approved', 'rejected'] }, admin_notes: { type: 'string' } } } } } },
        responses: jsonOk('Updated claim', { type: 'object' }),
      },
    },
    '/api/v1/admin/reviews': {
      get: {
        tags: ['Admin'], summary: 'List reviews for moderation', operationId: 'adminListReviews',
        security: [bearerAuth],
        parameters: [...paginationParams, { in: 'query', name: 'status', schema: { type: 'string', enum: ['pending', 'published', 'flagged', 'rejected'] } }],
        responses: paginatedResponse('AdminReview'),
      },
    },
    '/api/v1/admin/reviews/{id}': {
      patch: {
        tags: ['Admin'], summary: 'Moderate a review', operationId: 'adminModerateReview',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['approved', 'rejected', 'flagged'] }, admin_note: { type: 'string' } } } } } },
        responses: jsonOk('Moderated review', { type: 'object' }),
      },
    },
    '/api/v1/admin/enquiries': {
      get: {
        tags: ['Admin'], summary: 'List all enquiries with filters', operationId: 'adminListEnquiries',
        security: [bearerAuth],
        parameters: [...paginationParams,
          { in: 'query', name: 'status', schema: { type: 'string' } },
          { in: 'query', name: 'nursery_id', schema: { type: 'string' } },
          { in: 'query', name: 'claimed', schema: { type: 'string', enum: ['true', 'false'] } },
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } },
          { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: paginatedResponse('AdminEnquiry'),
      },
    },
    '/api/v1/admin/bookings': {
      get: {
        tags: ['Admin'], summary: 'List all visit bookings with filters', operationId: 'adminListBookings',
        security: [bearerAuth],
        parameters: [...paginationParams,
          { in: 'query', name: 'status', schema: { type: 'string' } },
          { in: 'query', name: 'nursery_id', schema: { type: 'string' } },
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'to', schema: { type: 'string', format: 'date' } },
        ],
        responses: paginatedResponse('AdminBooking'),
      },
    },
    '/api/v1/admin/subscriptions': {
      get: {
        tags: ['Admin'], summary: 'List provider subscriptions', operationId: 'adminListSubscriptions',
        security: [bearerAuth],
        parameters: paginationParams,
        responses: paginatedResponse('AdminSubscription'),
      },
    },
    '/api/v1/admin/ofsted-changes': {
      get: {
        tags: ['Admin'], summary: 'Recent Ofsted grade changes', operationId: 'adminOfstedChanges',
        security: [bearerAuth],
        parameters: [...paginationParams, { in: 'query', name: 'notified', schema: { type: 'string', enum: ['true', 'false'] } }],
        responses: jsonOk('Changes', { type: 'object' }),
      },
    },
    '/api/v1/admin/reports': {
      get: {
        tags: ['Admin'], summary: 'Platform reports (revenue, growth, coverage)', operationId: 'adminReports',
        security: [bearerAuth],
        parameters: [{ in: 'query', name: 'range', schema: { type: 'integer', default: 90 } }],
        responses: jsonOk('Reports', { type: 'object' }),
      },
    },
    '/api/v1/admin/reports/export': {
      get: {
        tags: ['Admin'], summary: 'Export admin reports as CSV', operationId: 'adminReportsExport',
        security: [bearerAuth],
        parameters: [{ in: 'query', name: 'range', schema: { type: 'integer', default: 90 } }],
        responses: { 200: { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string' } } } } },
      },
    },

    // ── Admin Invites ──────────────────────────────────────
    '/api/v1/admin/provider-invites/preview': {
      post: {
        tags: ['Admin Invites'], summary: 'Preview provider invite email', operationId: 'adminInvitePreview',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Preview', { type: 'object' }),
      },
    },
    '/api/v1/admin/provider-invites/send': {
      post: {
        tags: ['Admin Invites'], summary: 'Send provider invite emails', operationId: 'adminInviteSend',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Send result', { type: 'object' }),
      },
    },
    '/api/v1/admin/provider-invites/stats': {
      get: {
        tags: ['Admin Invites'], summary: 'Invite campaign stats', operationId: 'adminInviteStats',
        security: [bearerAuth],
        responses: jsonOk('Stats', { type: 'object' }),
      },
    },

    // ── Admin Promotions ───────────────────────────────────
    '/api/v1/admin/promotions': {
      get: {
        tags: ['Admin Promotions'], summary: 'List all promotions', operationId: 'adminListPromotions',
        security: [bearerAuth],
        responses: jsonOk('Promotions', { type: 'object' }),
      },
      post: {
        tags: ['Admin Promotions'], summary: 'Create a promotion', operationId: 'adminCreatePromotion',
        security: [bearerAuth],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Created' } },
      },
    },
    '/api/v1/admin/promotions/{id}': {
      patch: {
        tags: ['Admin Promotions'], summary: 'Update a promotion', operationId: 'adminUpdatePromotion',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: jsonOk('Updated', { type: 'object' }),
      },
      delete: {
        tags: ['Admin Promotions'], summary: 'Delete a promotion', operationId: 'adminDeletePromotion',
        security: [bearerAuth],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ── Ingest (admin-only) ────────────────────────────────
    '/api/v1/ingest/ofsted': {
      post: { tags: ['Ingest'], summary: 'Ingest Ofsted CSV data', operationId: 'ingestOfsted', security: [bearerAuth], responses: { 200: { description: 'Ingested' } } },
    },
    '/api/v1/ingest/geocode': {
      post: { tags: ['Ingest'], summary: 'Geocode nurseries via Postcodes.io', operationId: 'ingestGeocode', security: [bearerAuth], responses: { 200: { description: 'Geocoded' } } },
    },
    '/api/v1/ingest/aggregate-areas': {
      post: { tags: ['Ingest'], summary: 'Aggregate area stats from nurseries', operationId: 'ingestAggregateAreas', security: [bearerAuth], responses: { 200: { description: 'Aggregated' } } },
    },
    '/api/v1/ingest/property-stats': {
      post: { tags: ['Ingest'], summary: 'Refresh property stats', operationId: 'ingestPropertyStats', security: [bearerAuth], responses: { 200: { description: 'Refreshed' } } },
    },
    '/api/v1/ingest/land-registry': {
      post: { tags: ['Ingest'], summary: 'Ingest Land Registry price paid data', operationId: 'ingestLandRegistry', security: [bearerAuth], responses: { 200: { description: 'Ingested' } } },
    },
    '/api/v1/ingest/crime': {
      post: { tags: ['Ingest'], summary: 'Ingest police crime data', operationId: 'ingestCrime', security: [bearerAuth], responses: { 200: { description: 'Ingested' } } },
    },
    '/api/v1/ingest/imd': {
      post: { tags: ['Ingest'], summary: 'Ingest IMD deprivation data', operationId: 'ingestImd', security: [bearerAuth], responses: { 200: { description: 'Ingested' } } },
    },
    '/api/v1/ingest/family-scores': {
      post: { tags: ['Ingest'], summary: 'Recompute family scores', operationId: 'ingestFamilyScores', security: [bearerAuth], responses: { 200: { description: 'Computed' } } },
    },
    '/api/v1/ingest/dimension-scores': {
      post: { tags: ['Ingest'], summary: 'Recompute dimension scores', operationId: 'ingestDimensionScores', security: [bearerAuth], responses: { 200: { description: 'Computed' } } },
    },
    '/api/v1/ingest/schools': {
      post: { tags: ['Ingest'], summary: 'Ingest school data', operationId: 'ingestSchools', security: [bearerAuth], responses: { 200: { description: 'Ingested' } } },
    },
    '/api/v1/ingest/schools-geocode': {
      post: { tags: ['Ingest'], summary: 'Geocode schools', operationId: 'ingestSchoolsGeocode', security: [bearerAuth], responses: { 200: { description: 'Geocoded' } } },
    },

    // ── Sitemap ────────────────────────────────────────────
    '/api/v1/sitemap/nurseries': {
      get: { tags: ['Health'], summary: 'Sitemap nursery URLs', operationId: 'sitemapNurseries', responses: jsonOk('URLs', { type: 'object' }) },
    },
    '/api/v1/sitemap/districts': {
      get: { tags: ['Health'], summary: 'Sitemap district URLs', operationId: 'sitemapDistricts', responses: jsonOk('URLs', { type: 'object' }) },
    },
    '/api/v1/sitemap/towns': {
      get: { tags: ['Health'], summary: 'Sitemap town URLs', operationId: 'sitemapTowns', responses: jsonOk('URLs', { type: 'object' }) },
    },
    '/api/v1/sitemap/blog': {
      get: { tags: ['Health'], summary: 'Sitemap blog URLs', operationId: 'sitemapBlog', responses: jsonOk('URLs', { type: 'object' }) },
    },
  },

  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase JWT access token. Obtain via Supabase Auth sign-in.',
      },
    },
    schemas: {
      PaginationMeta: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          pages: { type: 'integer' },
        },
      },
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
          ofsted_overall_grade: { type: 'string', enum: ['Outstanding', 'Good', 'Requires improvement', 'Inadequate'], nullable: true },
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
          meta: { type: 'object', properties: { total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' }, pages: { type: 'integer' }, search_lat: { type: 'number' }, search_lng: { type: 'number' } } },
        },
      },
      Profile: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          display_name: { type: 'string', nullable: true },
          avatar_url: { type: 'string', nullable: true },
          home_postcode: { type: 'string', nullable: true },
          children: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, age_months: { type: 'integer' } } } },
          email_alerts: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      ProfileUpdate: {
        type: 'object',
        properties: {
          display_name: { type: 'string', nullable: true },
          avatar_url: { type: 'string', nullable: true },
          home_postcode: { type: 'string', nullable: true },
          children: { type: 'array', items: { type: 'object' } },
          email_alerts: { type: 'boolean' },
          email_weekly_digest: { type: 'boolean' },
          email_new_nurseries: { type: 'boolean' },
          email_marketing: { type: 'boolean' },
          preferences: { type: 'object' },
        },
      },
      AdminUser: {
        type: 'object',
        properties: { id: { type: 'string' }, display_name: { type: 'string', nullable: true }, role: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } },
      },
      AdminClaim: {
        type: 'object',
        properties: { id: { type: 'string' }, urn: { type: 'string' }, nursery_name: { type: 'string', nullable: true }, claimer_name: { type: 'string' }, claimer_email: { type: 'string' }, status: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } },
      },
      AdminReview: {
        type: 'object',
        properties: { id: { type: 'string' }, urn: { type: 'string' }, nursery_name: { type: 'string', nullable: true }, author_display_name: { type: 'string' }, rating: { type: 'integer' }, title: { type: 'string' }, body: { type: 'string' }, status: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } },
      },
      AdminEnquiry: {
        type: 'object',
        properties: { id: { type: 'string' }, user_id: { type: 'string' }, parent_name: { type: 'string', nullable: true }, nursery_id: { type: 'string' }, nursery_name: { type: 'string', nullable: true }, nursery_urn: { type: 'string', nullable: true }, nursery_claimed: { type: 'boolean' }, child_name: { type: 'string', nullable: true }, message: { type: 'string', nullable: true }, status: { type: 'string' }, requires_admin_review: { type: 'boolean' }, sent_at: { type: 'string', format: 'date-time' } },
      },
      AdminBooking: {
        type: 'object',
        properties: { id: { type: 'string' }, user_id: { type: 'string' }, parent_name: { type: 'string', nullable: true }, nursery_id: { type: 'string' }, nursery_name: { type: 'string', nullable: true }, nursery_urn: { type: 'string', nullable: true }, slot_date: { type: 'string', format: 'date' }, slot_time: { type: 'string' }, status: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } },
      },
      AdminSubscription: {
        type: 'object',
        properties: { id: { type: 'string' }, user_id: { type: 'string' }, display_name: { type: 'string', nullable: true }, tier: { type: 'string' }, status: { type: 'string' }, current_period_end: { type: 'string', format: 'date-time', nullable: true }, created_at: { type: 'string', format: 'date-time' } },
      },
    },
  },
}

export default openapi
