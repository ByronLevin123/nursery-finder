(function () {
  var container = document.getElementById('nursery-widget');
  if (!container) return;

  var postcode = container.getAttribute('data-postcode') || '';
  var limit = parseInt(container.getAttribute('data-limit') || '5', 10);
  var radius = parseFloat(container.getAttribute('data-radius') || '3');
  var apiBase = container.getAttribute('data-api') || 'https://nursery-finder-6u7r.onrender.com';
  var siteBase = container.getAttribute('data-site') || 'https://nurserymatch.com';

  if (!postcode) {
    container.innerHTML = '<p style="color:#999;font-size:13px;">Set data-postcode on the widget container.</p>';
    return;
  }

  var GRADE_COLORS = {
    'Outstanding': '#16a34a',
    'Good': '#2563eb',
    'Requires improvement': '#d97706',
    'Inadequate': '#dc2626'
  };

  container.innerHTML = '<p style="color:#999;font-size:13px;">Loading nurseries near ' + postcode + '...</p>';

  fetch(apiBase + '/api/v1/nurseries/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postcode: postcode, radius_km: radius, limit: limit })
  })
    .then(function (res) { return res.json(); })
    .then(function (result) {
      var nurseries = result.data || [];
      if (nurseries.length === 0) {
        container.innerHTML = '<p style="color:#999;font-size:13px;">No nurseries found near ' + postcode + '.</p>';
        return;
      }

      var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">';
      html += '<p style="font-size:14px;font-weight:600;color:#111;margin:0 0 12px 0;">Nurseries near ' + postcode + '</p>';

      nurseries.forEach(function (n) {
        var gradeColor = GRADE_COLORS[n.ofsted_overall_grade] || '#6b7280';
        html += '<div style="padding:12px;margin-bottom:8px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">';
        html += '<a href="' + siteBase + '/nursery/' + n.urn + '" target="_blank" rel="noopener" style="font-size:14px;font-weight:600;color:#111;text-decoration:none;">' + n.name + '</a>';
        if (n.ofsted_overall_grade) {
          html += '<span style="font-size:11px;font-weight:600;color:' + gradeColor + ';background:' + gradeColor + '18;padding:2px 8px;border-radius:12px;white-space:nowrap;">' + n.ofsted_overall_grade + '</span>';
        }
        html += '</div>';
        html += '<div style="font-size:12px;color:#6b7280;margin-top:4px;">';
        if (n.distance_km != null) html += n.distance_km.toFixed(1) + 'km away';
        if (n.fee_avg_monthly) html += ' &middot; ~&pound;' + n.fee_avg_monthly + '/mo';
        if (n.places_funded_2yr > 0) html += ' &middot; 2yr funded';
        html += '</div>';
        html += '</div>';
      });

      html += '<p style="font-size:11px;color:#9ca3af;margin:8px 0 0 0;">';
      html += 'Powered by <a href="' + siteBase + '" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:none;">NurseryMatch</a>';
      html += ' &middot; Contains Ofsted data &copy; Crown copyright';
      html += '</p>';
      html += '</div>';

      container.innerHTML = html;
    })
    .catch(function () {
      container.innerHTML = '<p style="color:#dc2626;font-size:13px;">Failed to load nursery data.</p>';
    });
})();
