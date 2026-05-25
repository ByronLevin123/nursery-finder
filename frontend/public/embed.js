/**
 * NurseryMatch Embeddable Widget v2
 * Drop-in nursery intelligence for property listings.
 *
 * Usage:
 *   <div data-nursery-widget data-postcode="SW11 1AA"></div>
 *   <script src="https://nurserymatch.com/embed.js" defer></script>
 *
 * Legacy usage (still supported):
 *   <div id="nursery-widget" data-postcode="SW11 1AA"></div>
 *
 * Data attributes:
 *   data-postcode       — UK postcode (required)
 *   data-limit          — max nurseries to show (default 5)
 *   data-radius         — search radius in km (default 3)
 *   data-api-key        — developer API key (optional, higher rate limit)
 *   data-theme          — "light" (default) or "dark"
 *   data-hide-branding  — "true" to hide Powered by NurseryMatch (pro tier)
 *   data-api            — custom API base URL (optional)
 *   data-site           — custom site base URL (optional)
 */
;(function () {
  'use strict'

  var API = 'https://nursery-finder-6u7r.onrender.com'
  var SITE = 'https://nurserymatch.com'

  var GRADE_COLORS = {
    Outstanding: '#059669',
    Good: '#2563eb',
    'Requires improvement': '#d97706',
    Inadequate: '#dc2626',
  }

  function esc(s) {
    var d = document.createElement('div')
    d.textContent = s
    return d.innerHTML
  }

  function scoreColor(score) {
    if (score >= 70) return '#059669'
    if (score >= 40) return '#d97706'
    return '#dc2626'
  }

  function scoreLabel(score) {
    if (score >= 70) return 'Great for families'
    if (score >= 40) return 'Good for families'
    return 'Below average'
  }

  function distanceText(km) {
    if (km == null) return ''
    if (km < 1) return Math.round(km * 1000) + 'm'
    return km.toFixed(1) + 'km'
  }

  function fetchJson(url, apiKey) {
    var opts = {}
    if (apiKey) opts.headers = { 'X-Api-Key': apiKey }
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error(r.status)
      return r.json()
    })
  }

  function buildStyles(theme) {
    var bg = theme === 'dark' ? '#1f2937' : '#ffffff'
    var text = theme === 'dark' ? '#f3f4f6' : '#1f2937'
    var muted = theme === 'dark' ? '#9ca3af' : '#6b7280'
    var border = theme === 'dark' ? '#374151' : '#e5e7eb'
    var cardBg = theme === 'dark' ? '#111827' : '#f9fafb'

    return (
      '.nm-root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:' + bg + ';color:' + text + ';border:1px solid ' + border + ';border-radius:12px;overflow:hidden;max-width:400px;box-sizing:border-box}' +
      '.nm-root *{box-sizing:border-box}' +
      '.nm-header{padding:16px;display:flex;align-items:center;gap:12px}' +
      '.nm-score{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;flex-shrink:0}' +
      '.nm-title{font-size:15px;font-weight:600}' +
      '.nm-subtitle{font-size:12px;color:' + muted + ';margin-top:2px}' +
      '.nm-toggle{padding:0 16px 8px;text-align:center}' +
      '.nm-toggle button{background:none;border:none;color:#2563eb;cursor:pointer;font-size:13px;font-weight:500;padding:4px 8px}' +
      '.nm-toggle button:hover{text-decoration:underline}' +
      '.nm-list{border-top:1px solid ' + border + ';max-height:0;overflow:hidden;transition:max-height 0.3s ease}' +
      '.nm-list.nm-open{max-height:600px}' +
      '.nm-item{padding:12px 16px;border-bottom:1px solid ' + border + ';display:flex;justify-content:space-between;align-items:center;background:' + cardBg + '}' +
      '.nm-item:last-child{border-bottom:none}' +
      '.nm-item-name{font-size:13px;font-weight:600;text-decoration:none;color:' + text + '}' +
      '.nm-item-name:hover{color:#2563eb}' +
      '.nm-item-meta{font-size:11px;color:' + muted + ';margin-top:2px}' +
      '.nm-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;color:#fff;white-space:nowrap}' +
      '.nm-footer{padding:8px 16px;text-align:center;border-top:1px solid ' + border + '}' +
      '.nm-footer a{font-size:11px;color:' + muted + ';text-decoration:none}' +
      '.nm-footer a:hover{color:#2563eb}' +
      '.nm-loading{padding:24px;text-align:center;color:' + muted + ';font-size:13px}' +
      '.nm-error{padding:16px;text-align:center;color:#dc2626;font-size:13px}'
    )
  }

  function initWidget(el) {
    var postcode = (el.getAttribute('data-postcode') || '').trim()
    if (!postcode) {
      el.innerHTML = '<p style="color:#999;font-size:13px;">Set data-postcode on the widget container.</p>'
      return
    }

    var limit = parseInt(el.getAttribute('data-limit')) || 5
    var radius = parseFloat(el.getAttribute('data-radius')) || 3
    var apiKey = el.getAttribute('data-api-key') || ''
    var theme = el.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    var hideBranding = el.getAttribute('data-hide-branding') === 'true'
    var apiBase = el.getAttribute('data-api') || API
    var siteBase = el.getAttribute('data-site') || SITE

    // Use shadow DOM if supported, otherwise render inline
    var root, styleEl
    if (el.attachShadow) {
      var shadow = el.attachShadow({ mode: 'closed' })
      styleEl = document.createElement('style')
      styleEl.textContent = buildStyles(theme)
      shadow.appendChild(styleEl)
      root = document.createElement('div')
      shadow.appendChild(root)
    } else {
      root = el
    }

    var wrapper = document.createElement('div')
    wrapper.className = 'nm-root'
    wrapper.innerHTML = '<div class="nm-loading">Loading nurseries near ' + esc(postcode) + '…</div>'
    root.appendChild(wrapper)

    // If no shadow DOM, inject styles into the wrapper
    if (!el.attachShadow) {
      var inlineStyle = document.createElement('style')
      inlineStyle.textContent = buildStyles(theme)
      wrapper.prepend(inlineStyle)
    }

    var district = postcode.split(' ')[0].toUpperCase()
    var headers = apiKey ? { 'X-Api-Key': apiKey } : {}

    var areaP = fetchJson(apiBase + '/api/v1/areas/' + encodeURIComponent(district), apiKey).catch(function () {
      return null
    })
    var searchP = fetch(apiBase + '/api/v1/nurseries/search', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify({ postcode: postcode, radius_km: radius, limit: limit }),
    })
      .then(function (r) {
        return r.ok ? r.json() : null
      })
      .catch(function () {
        return null
      })

    Promise.all([areaP, searchP]).then(function (results) {
      var area = results[0]
      var search = results[1]

      if (!area && !search) {
        wrapper.innerHTML = '<div class="nm-error">Unable to load nursery data</div>'
        return
      }

      var score = area ? Math.round(area.family_score || 0) : null
      var nurseries = search && search.data ? search.data.slice(0, limit) : []
      var html = ''

      // Family Score badge
      if (score !== null && score > 0) {
        html += '<div class="nm-header">'
        html += '<div class="nm-score" style="background:' + scoreColor(score) + '">' + score + '</div>'
        html += '<div><div class="nm-title">' + esc(scoreLabel(score)) + '</div>'
        html +=
          '<div class="nm-subtitle">Family Score for ' +
          esc(district) +
          ' · ' +
          (area.nursery_count_total || 0) +
          ' nurseries nearby</div>'
        html += '</div></div>'
      }

      // Expandable nursery list
      if (nurseries.length > 0) {
        html +=
          '<div class="nm-toggle"><button type="button" data-nm-toggle>Show ' +
          nurseries.length +
          ' nearby nurseries ▼</button></div>'
        html += '<div class="nm-list" data-nm-list>'
        for (var i = 0; i < nurseries.length; i++) {
          var n = nurseries[i]
          var grade = n.ofsted_overall_grade || 'Not rated'
          var color = GRADE_COLORS[grade] || '#6b7280'
          html += '<div class="nm-item">'
          html += '<div>'
          html +=
            '<a class="nm-item-name" href="' +
            siteBase +
            '/nursery/' +
            encodeURIComponent(n.urn) +
            '" target="_blank" rel="noopener">' +
            esc(n.name || 'Nursery') +
            '</a>'
          var meta = []
          if (n.distance_km != null) meta.push(distanceText(n.distance_km))
          if (n.town) meta.push(esc(n.town))
          if (n.fee_avg_monthly) meta.push('~£' + n.fee_avg_monthly + '/mo')
          html += '<div class="nm-item-meta">' + meta.join(' · ') + '</div>'
          html += '</div>'
          html += '<span class="nm-badge" style="background:' + color + '">' + esc(grade) + '</span>'
          html += '</div>'
        }
        html += '</div>'
      }

      // Footer with branding + attribution
      if (!hideBranding) {
        html +=
          '<div class="nm-footer"><a href="' +
          siteBase +
          '/search?postcode=' +
          encodeURIComponent(postcode) +
          '" target="_blank" rel="noopener">Powered by NurseryMatch</a>'
        html += ' · Contains Ofsted data © Crown copyright</div>'
      }

      wrapper.innerHTML = html

      // Wire up toggle
      var toggleBtn = (el.attachShadow ? root : wrapper).querySelector('[data-nm-toggle]')
      var listEl = (el.attachShadow ? root : wrapper).querySelector('[data-nm-list]')
      if (toggleBtn && listEl) {
        toggleBtn.addEventListener('click', function () {
          var open = listEl.classList.toggle('nm-open')
          toggleBtn.textContent = open
            ? 'Hide nurseries ▲'
            : 'Show ' + nurseries.length + ' nearby nurseries ▼'
        })
      }
    })
  }

  function init() {
    // Support both new data-nursery-widget and legacy id="nursery-widget"
    var widgets = document.querySelectorAll('[data-nursery-widget]')
    for (var i = 0; i < widgets.length; i++) {
      initWidget(widgets[i])
    }
    // Legacy support
    var legacy = document.getElementById('nursery-widget')
    if (legacy && !legacy.hasAttribute('data-nursery-widget')) {
      initWidget(legacy)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
