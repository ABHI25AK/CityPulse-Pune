/**
 * CityPulse Pune — Core Application Logic
 * Single Page Architecture without dependencies/frameworks.
 * Features:
 *  - Live Weather fetch via Open-Meteo
 *  - Interactive Leaflet Maps with category color pins
 *  - Places Filtering, Detail Inspection, and Search
 *  - Head-to-Head Compare Matrix with min/max indicator
 *  - Safety Overlay & Straight-line Awareness Helper
 *  - Citizen Incident Reports with LocalStorage & Map Pinning
 *  - Rule-based Itinerary Generator
 */

// Global App State
const state = {
  places: [],
  selectedPlaceId: null,
  activeCategory: 'all',
  searchQuery: '',
  maxBudget: 15000,
  comparisonSelection: [], // array of IDs, max 3
  reports: [],
  tempReportCoord: null,
  tempPhotoBase64: null,
  tempAudioBase64: null,
  mediaRecorder: null,
  audioChunks: [],
  recordingInterval: null,
  recordingSeconds: 0,
  
  // Maps & Markers
  maps: {
    explore: null,
    safety: null,
    report: null
  },
  markers: {
    explore: {},
    safetyCircles: [],
    routeLine: null,
    reportPicker: null,
    reportFeedMarkers: []
  }
};

// Default Pune Coordinates
const PUNE_CENTER = [18.5204, 73.8567];
const DEFAULT_ZOOM = 12;

// Storage Keys
const STORAGE_KEY_REPORTS = 'citypulseReports';

// Category Marker Colors & Icons
const CATEGORY_CONFIG = {
  heritage: { color: '#dc2626', pinClass: 'pin-heritage', label: 'Heritage', icon: '🏛️' },
  food: { color: '#f97316', pinClass: 'pin-food', label: 'Food', icon: '☕' },
  hotels: { color: '#8b5cf6', pinClass: 'pin-hotels', label: 'Hotels', icon: '🏨' },
  attractions: { color: '#0284c7', pinClass: 'pin-attractions', label: 'Attractions', icon: '🎨' },
  safety: { color: '#991b1b', pinClass: 'pin-safety', label: 'Safety Zones', icon: '⚠️' }
};

// Helper: Escape user input to prevent XSS
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Custom Leaflet DivIcon creator
function createCustomPin(category) {
  const conf = CATEGORY_CONFIG[category] || { pinClass: 'pin-attractions', icon: '📍' };
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="custom-pin ${conf.pinClass}"><div class="custom-pin-inner">${conf.icon}</div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28]
  });
}

function createReportPin() {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="custom-pin pin-report"><div class="custom-pin-inner">📢</div></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -26]
  });
}

// ==========================================================================
// Initialization on DOMContentLoaded
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadPlacesData();
  fetchPuneWeather();
  initCitizenReports();
  initPlanMyDay();
});

// ==========================================================================
// Tab Switching System
// ==========================================================================
function initTabs() {
  const tabBtns = document.querySelectorAll('.nav-tab');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  // Update nav buttons
  document.querySelectorAll('.nav-tab').forEach(btn => {
    const isActive = btn.getAttribute('data-tab') === tabId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  const activePaneMap = {
    explore: 'viewExplore',
    compare: 'viewCompare',
    safety: 'viewSafety',
    reports: 'viewReports',
    plan: 'viewPlan'
  };

  const targetPane = document.getElementById(activePaneMap[tabId]);
  if (targetPane) {
    targetPane.classList.add('active');
  }

  // Invalidate map sizes if newly visible
  setTimeout(() => {
    if (tabId === 'explore' && state.maps.explore) state.maps.explore.invalidateSize();
    if (tabId === 'safety') {
      if (!state.maps.safety) initSafetyMap();
      else state.maps.safety.invalidateSize();
    }
    if (tabId === 'reports') {
      if (!state.maps.report) initReportMap();
      else state.maps.report.invalidateSize();
    }
    if (tabId === 'compare') {
      renderCompareTab();
    }
  }, 100);
}

// ==========================================================================
// Weather Widget (Open-Meteo API)
// ==========================================================================
async function fetchPuneWeather() {
  const loadingEl = document.getElementById('weatherLoading');
  const contentEl = document.getElementById('weatherContent');
  const tempEl = document.getElementById('weatherTemp');
  const metaEl = document.getElementById('weatherMeta');
  const badgeEl = document.getElementById('weatherAlertBadge');
  const iconEl = document.getElementById('weatherIcon');

  const endpoint = 'https://api.open-meteo.com/v1/forecast?latitude=18.5204&longitude=73.8567&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=Asia%2FKolkata';

  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Weather HTTP status: ${res.status}`);
    const data = await res.json();
    const current = data.current;

    if (!current) throw new Error('No current weather payload');

    const temp = Math.round(current.temperature_2m);
    const precip = current.precipitation || 0;
    const humidity = current.relative_humidity_2m || '--';

    tempEl.textContent = `${temp}°C`;
    metaEl.textContent = `Humidity: ${humidity}% | Precip: ${precip}mm`;

    // Weather condition icon & alerts logic
    if (precip > 0) {
      badgeEl.textContent = '🌧️ Rain alert';
      badgeEl.className = 'weather-alert-badge rain-alert';
      iconEl.textContent = '🌧️';
    } else if (temp >= 35) {
      badgeEl.textContent = '🔥 Heat alert';
      badgeEl.className = 'weather-alert-badge heat-alert';
      iconEl.textContent = '☀️';
    } else {
      badgeEl.textContent = '✨ Good time to explore';
      badgeEl.className = 'weather-alert-badge';
      iconEl.textContent = temp < 20 ? '🌤️' : '☀️';
    }

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
  } catch (err) {
    // Graceful fallback without breaking app
    console.warn('Weather service notice: Using fallback state.', err);
    if (loadingEl) {
      loadingEl.innerHTML = '<span aria-hidden="true">⛅</span> <span>Pune: Weather unavailable</span>';
    }
  }
}

// ==========================================================================
// Data Loader: places.json
// ==========================================================================
async function loadPlacesData() {
  const listContainer = document.getElementById('placesListContainer');
  try {
    const response = await fetch('places.json');
    if (!response.ok) throw new Error(`Failed to load places.json: ${response.status}`);
    const data = await response.json();
    state.places = Array.isArray(data) ? data : [];
    
    // Init components dependent on places
    initExploreMap();
    initExploreFilters();
    renderPlacesList();
    initCompareSelectors();
    initSafetyRouteHelper();
  } catch (err) {
    console.error('Error loading places:', err);
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h4 class="empty-state-title">Unable to load Pune places</h4>
          <p class="empty-state-text">Please verify places.json is served properly. If running locally, check python http.server.</p>
        </div>
      `;
    }
  }
}

// ==========================================================================
// TAB 1: Explore Map & Filter Dashboard
// ==========================================================================
function initExploreMap() {
  const mapElement = document.getElementById('exploreMap');
  if (!mapElement || state.maps.explore) return;

  state.maps.explore = L.map('exploreMap', {
    center: PUNE_CENTER,
    zoom: DEFAULT_ZOOM,
    scrollWheelZoom: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(state.maps.explore);

  renderExploreMarkers();
}

function renderExploreMarkers() {
  if (!state.maps.explore) return;

  // Clear existing
  Object.values(state.markers.explore).forEach(marker => marker.remove());
  state.markers.explore = {};

  state.places.forEach(place => {
    const icon = createCustomPin(place.category);
    const marker = L.marker([place.lat, place.lng], { icon }).addTo(state.maps.explore);
    
    // Popup
    const popupContent = `
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
        <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 2px;">${escapeHTML(place.name)}</strong>
        <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: ${CATEGORY_CONFIG[place.category]?.color || '#2563eb'}">
          ${CATEGORY_CONFIG[place.category]?.label || place.category}
        </span>
        <div style="margin: 4px 0; color: #475569;">
          ⭐ <strong>${place.rating}</strong>/5 &bull; 🛡️ Safety: <strong>${place.safety}</strong>/5
        </div>
        <div style="color: #64748b; font-size: 12px; margin-bottom: 6px;">
          Avg Price: <strong>₹${place.avgPrice}</strong>
        </div>
        <button onclick="window.selectPlaceFromPopup(${place.id})" style="background: #2563eb; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">
          View Full Details
        </button>
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.on('click', () => {
      selectPlace(place.id, false);
    });

    state.markers.explore[place.id] = marker;
  });
}

// Global popup helper
window.selectPlaceFromPopup = function(placeId) {
  selectPlace(placeId, true);
};

function initExploreFilters() {
  const searchInput = document.getElementById('searchInput');
  const categoryPills = document.querySelectorAll('.pill-btn');
  const budgetSlider = document.getElementById('budgetSlider');
  const budgetDisplay = document.getElementById('budgetDisplay');
  const resetBtn = document.getElementById('resetFiltersBtn');

  // Search input
  searchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    applyExploreFilters();
  });

  // Category pills
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-checked', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-checked', 'true');
      state.activeCategory = pill.getAttribute('data-category');
      applyExploreFilters();
    });
  });

  // Budget slider
  budgetSlider?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    state.maxBudget = val;
    budgetDisplay.textContent = val >= 15000 ? 'Any (₹15,000+)' : `₹${val.toLocaleString('en-IN')}`;
    applyExploreFilters();
  });

  // Reset
  resetBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    state.searchQuery = '';
    state.activeCategory = 'all';
    categoryPills.forEach(p => {
      const isAll = p.getAttribute('data-category') === 'all';
      p.classList.toggle('active', isAll);
      p.setAttribute('aria-checked', isAll ? 'true' : 'false');
    });
    if (budgetSlider) budgetSlider.value = 15000;
    state.maxBudget = 15000;
    if (budgetDisplay) budgetDisplay.textContent = 'Any (₹15,000)';
    applyExploreFilters();
  });
}

function getFilteredPlaces() {
  return state.places.filter(place => {
    // Category check
    if (state.activeCategory !== 'all' && place.category !== state.activeCategory) {
      return false;
    }
    // Budget check
    if (place.avgPrice > state.maxBudget) {
      return false;
    }
    // Search query check
    if (state.searchQuery) {
      const matchName = place.name.toLowerCase().includes(state.searchQuery);
      const matchDesc = place.description.toLowerCase().includes(state.searchQuery);
      const matchCat = place.category.toLowerCase().includes(state.searchQuery);
      if (!matchName && !matchDesc && !matchCat) return false;
    }
    return true;
  });
}

function applyExploreFilters() {
  const filtered = getFilteredPlaces();
  renderPlacesList(filtered);

  // Update map marker visibility
  const filteredIds = new Set(filtered.map(p => p.id));
  Object.entries(state.markers.explore).forEach(([idStr, marker]) => {
    const id = parseInt(idStr, 10);
    if (filteredIds.has(id)) {
      if (!state.maps.explore.hasLayer(marker)) marker.addTo(state.maps.explore);
    } else {
      if (state.maps.explore.hasLayer(marker)) marker.remove();
    }
  });

  // Update count indicator
  const countEl = document.getElementById('placesFoundCount');
  if (countEl) {
    countEl.textContent = `Showing ${filtered.length} of ${state.places.length} places`;
  }
}

function renderPlacesList(list = null) {
  const container = document.getElementById('placesListContainer');
  if (!container) return;

  const places = list !== null ? list : getFilteredPlaces();

  if (places.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h4 class="empty-state-title">No matching Pune locations</h4>
        <p class="empty-state-text">Try adjusting your category filter, increasing your budget limit, or clearing the search keyword.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = places.map(p => {
    const isSelected = p.id === state.selectedPlaceId;
    const catConf = CATEGORY_CONFIG[p.category] || { label: p.category, pinClass: 'pin-attractions' };
    const priceText = p.avgPrice === 0 ? 'Free entry' : `₹${p.avgPrice.toLocaleString('en-IN')}`;

    return `
      <div class="place-sidebar-card ${isSelected ? 'selected' : ''}" 
           data-id="${p.id}" 
           data-cat="${p.category}"
           role="button" 
           tabindex="0"
           aria-pressed="${isSelected ? 'true' : 'false'}"
           onclick="window.selectPlace(${p.id})">
        <div class="card-top-row">
          <h3 class="place-name">${escapeHTML(p.name)}</h3>
          <span class="category-tag tag-${p.category}">${catConf.label}</span>
        </div>
        <div class="card-stats-row">
          <span class="stat-item stat-rating">⭐ ${p.rating}</span>
          <span class="stat-item stat-price">💵 ${priceText}</span>
          <span class="stat-item">🛡️ Safety: ${p.safety}/5</span>
          <span class="stat-item">✨ Clean: ${p.cleanliness}/5</span>
        </div>
      </div>
    `;
  }).join('');
}

// Make selectPlace globally accessible
window.selectPlace = function(placeId, shouldScroll = false) {
  state.selectedPlaceId = placeId;
  const place = state.places.find(p => p.id === placeId);
  if (!place) return;

  // Update list cards selection
  document.querySelectorAll('.place-sidebar-card').forEach(card => {
    const cardId = parseInt(card.getAttribute('data-id'), 10);
    const isSel = cardId === placeId;
    card.classList.toggle('selected', isSel);
    card.setAttribute('aria-pressed', isSel ? 'true' : 'false');
  });

  // Focus map marker
  const marker = state.markers.explore[placeId];
  if (marker && state.maps.explore) {
    state.maps.explore.setView([place.lat, place.lng], 15, { animate: true });
    marker.openPopup();
  }

  // Render detail card
  renderPlaceDetail(place);

  if (shouldScroll) {
    const detailCard = document.getElementById('placeDetailCard');
    detailCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

function renderPlaceDetail(place) {
  const placeholder = document.getElementById('detailPlaceholder');
  const actual = document.getElementById('detailActual');
  if (!placeholder || !actual) return;

  placeholder.classList.add('hidden');
  actual.classList.remove('hidden');

  const catConf = CATEGORY_CONFIG[place.category] || { label: place.category };
  const priceDisplay = place.avgPrice === 0 ? 'Free (₹0)' : `₹${place.avgPrice.toLocaleString('en-IN')} per person`;

  const renderMetric = (label, score) => `
    <div class="score-metric-box">
      <span class="score-metric-label">${label}</span>
      <div class="score-metric-val">${score} <span class="score-denom">/ 5</span></div>
      <div class="score-bar-bg">
        <div class="score-bar-fill" style="width: ${(score / 5) * 100}%"></div>
      </div>
    </div>
  `;

  actual.innerHTML = `
    <div class="detail-header-row">
      <div>
        <h3 class="detail-title">${escapeHTML(place.name)}</h3>
        <span class="category-tag tag-${place.category}" style="display:inline-block; margin-top:4px;">${catConf.label}</span>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 0.8rem; color: #64748b; display: block;">Average Cost</span>
        <strong style="font-size: 1.15rem; color: #0f172a;">${priceDisplay}</strong>
      </div>
    </div>

    <p class="detail-desc">${escapeHTML(place.description)}</p>

    <!-- Visual Score Cards -->
    <div class="scores-metrics-grid">
      ${renderMetric('Overall Rating', place.rating)}
      ${renderMetric('Safety Score', place.safety)}
      ${renderMetric('Cleanliness', place.cleanliness)}
      ${renderMetric('Affordability', place.affordability)}
      ${renderMetric('Accessibility', place.accessibility)}
    </div>

    <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem; flex-wrap: wrap;">
      <button class="btn btn-outline" style="padding: 0.45rem 0.85rem; font-size: 0.82rem;" onclick="window.addToCompareFromDetail(${place.id})">
        ⚖️ Add to Comparison
      </button>
      <span style="font-size: 0.76rem; color: #94a3b8; align-self: center;">
        *Safety & cleanliness indices are sample demo metrics.
      </span>
    </div>
  `;
}

window.addToCompareFromDetail = function(placeId) {
  if (state.comparisonSelection.includes(placeId)) {
    switchTab('compare');
    return;
  }
  if (state.comparisonSelection.length >= 3) {
    alert('You can compare a maximum of 3 places at once. Clear or deselect one first.');
    return;
  }
  state.comparisonSelection.push(placeId);
  updateCompareSelectionUI();
  switchTab('compare');
};

// ==========================================================================
// TAB 2: Compare Matrix & Insights
// ==========================================================================
function initCompareSelectors() {
  const container = document.getElementById('compareSelectorGrid');
  const clearBtn = document.getElementById('clearCompareBtn');
  if (!container) return;

  container.innerHTML = state.places.map(p => `
    <div class="compare-select-chip" data-id="${p.id}" onclick="window.toggleComparePlace(${p.id})">
      <div class="compare-chip-title">${escapeHTML(p.name)}</div>
      <div class="compare-chip-sub">${CATEGORY_CONFIG[p.category]?.label || p.category} &bull; ₹${p.avgPrice}</div>
    </div>
  `).join('');

  clearBtn?.addEventListener('click', () => {
    state.comparisonSelection = [];
    updateCompareSelectionUI();
    renderCompareTable();
  });

  renderCompareInsights();
}

window.toggleComparePlace = function(placeId) {
  const idx = state.comparisonSelection.indexOf(placeId);
  if (idx > -1) {
    state.comparisonSelection.splice(idx, 1);
  } else {
    if (state.comparisonSelection.length >= 3) {
      alert('Maximum 3 places can be compared at a time.');
      return;
    }
    state.comparisonSelection.push(placeId);
  }
  updateCompareSelectionUI();
  renderCompareTable();
};

function updateCompareSelectionUI() {
  const countBadge = document.getElementById('compareSelectionCount');
  if (countBadge) {
    countBadge.textContent = `${state.comparisonSelection.length} of 3 selected`;
  }

  document.querySelectorAll('.compare-select-chip').forEach(chip => {
    const id = parseInt(chip.getAttribute('data-id'), 10);
    const isChecked = state.comparisonSelection.includes(id);
    chip.classList.toggle('checked', isChecked);
  });
}

function renderCompareTab() {
  updateCompareSelectionUI();
  renderCompareTable();
}

function renderCompareTable() {
  const container = document.getElementById('compareResultCard');
  if (!container) return;

  const count = state.comparisonSelection.length;
  if (count < 2) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚖️</div>
        <h4 class="empty-state-title">Select at least 2 places to compare</h4>
        <p class="empty-state-text">Choose 2 or 3 places from the selectable chips above to view an interactive side-by-side metric comparison.</p>
      </div>
    `;
    return;
  }

  const selectedPlaces = state.comparisonSelection.map(id => state.places.find(p => p.id === id)).filter(Boolean);

  // Define comparison metrics
  const metrics = [
    { key: 'rating', label: 'Rating (out of 5)', format: v => `${v} ⭐`, isPrice: false },
    { key: 'safety', label: 'Safety Score (out of 5)', format: v => `${v} / 5`, isPrice: false },
    { key: 'cleanliness', label: 'Cleanliness (out of 5)', format: v => `${v} / 5`, isPrice: false },
    { key: 'affordability', label: 'Affordability (out of 5)', format: v => `${v} / 5`, isPrice: false },
    { key: 'accessibility', label: 'Accessibility (out of 5)', format: v => `${v} / 5`, isPrice: false },
    { key: 'avgPrice', label: 'Average Price (INR)', format: v => v === 0 ? 'Free' : `₹${v.toLocaleString('en-IN')}`, isPrice: true }
  ];

  let tableHtml = `
    <table class="compare-table" aria-label="Side-by-side place comparison table">
      <thead>
        <tr>
          <th class="metric-name-col">Metric</th>
          ${selectedPlaces.map(p => `<th>${escapeHTML(p.name)}<br><small style="font-weight:normal; color:#64748b;">${CATEGORY_CONFIG[p.category]?.label || p.category}</small></th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  metrics.forEach(m => {
    const values = selectedPlaces.map(p => p[m.key]);
    
    let bestVal, worstVal;
    if (m.isPrice) {
      // Lower price is better
      bestVal = Math.min(...values);
      worstVal = Math.max(...values);
    } else {
      // Higher score is better
      bestVal = Math.max(...values);
      worstVal = Math.min(...values);
    }

    const allIdentical = bestVal === worstVal;

    tableHtml += `
      <tr>
        <td class="metric-name-col">${m.label}</td>
        ${selectedPlaces.map(p => {
          const val = p[m.key];
          let highlightClass = '';
          if (!allIdentical) {
            if (val === bestVal) highlightClass = 'cell-best';
            else if (val === worstVal) highlightClass = 'cell-worst';
          }
          return `<td><span class="score-cell-value ${highlightClass}">${m.format(val)}</span></td>`;
        }).join('')}
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
    <div class="compare-legend-row">
      <span><span class="legend-swatch" style="background:#dcfce7; border:1px solid #86efac;"></span><strong>Green:</strong> Best score across selection (or lower price)</span>
      <span><span class="legend-swatch" style="background:#fee2e2; border:1px solid #fca5a5;"></span><strong>Red:</strong> Worst score across selection (or higher price)</span>
    </div>
  `;

  container.innerHTML = tableHtml;
}

function renderCompareInsights() {
  const bestListEl = document.getElementById('bestPlacesList');
  const avoidListEl = document.getElementById('avoidPlacesList');
  if (!bestListEl || !avoidListEl) return;

  // Composite score: Rating + Safety + Cleanliness + Affordability + Accessibility
  const scoredPlaces = state.places
    .filter(p => p.category !== 'safety')
    .map(p => {
      const composite = (p.rating + p.safety + p.cleanliness + p.affordability + p.accessibility) / 5;
      return { ...p, compositeScore: Math.round(composite * 10) / 10 };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, 4);

  bestListEl.innerHTML = scoredPlaces.map((p, idx) => `
    <div class="rank-item-card">
      <div class="rank-left">
        <div class="rank-number">${idx + 1}</div>
        <div>
          <strong style="color: #0f172a; font-size: 0.92rem;">${escapeHTML(p.name)}</strong>
          <div style="font-size: 0.75rem; color: #64748b;">${CATEGORY_CONFIG[p.category]?.label || p.category} &bull; Rating: ${p.rating}⭐</div>
        </div>
      </div>
      <div class="rank-score">${p.compositeScore.toFixed(1)} / 5.0</div>
    </div>
  `).join('');

  // Unsafe / Avoid places
  const avoidPlaces = state.places.filter(p => p.category === 'safety');
  avoidListEl.innerHTML = avoidPlaces.map(p => `
    <div class="avoid-item-card">
      <div class="avoid-item-title">⚠️ ${escapeHTML(p.name)} (Safety Score: ${p.safety}/5)</div>
      <p class="avoid-item-desc">${escapeHTML(p.description)}</p>
    </div>
  `).join('');
}

// ==========================================================================
// TAB 3: Safety Map & Straight-line Awareness Helper
// ==========================================================================
function initSafetyMap() {
  const mapEl = document.getElementById('safetyMap');
  if (!mapEl || state.maps.safety) return;

  state.maps.safety = L.map('safetyMap', {
    center: PUNE_CENTER,
    zoom: DEFAULT_ZOOM
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.maps.safety);

  // Render Red Caution Circles around sample safety zones
  const safetyZones = state.places.filter(p => p.category === 'safety');
  safetyZones.forEach(zone => {
    // 1200m buffer circle
    const circle = L.circle([zone.lat, zone.lng], {
      color: '#dc2626',
      fillColor: '#ef4444',
      fillOpacity: 0.28,
      radius: 1200,
      weight: 2
    }).addTo(state.maps.safety);

    circle.bindPopup(`
      <div style="font-size: 13px;">
        <strong style="color:#b91c1c;">⚠️ ${escapeHTML(zone.name)}</strong>
        <p style="margin:4px 0; color:#334155; font-size:12px;">Demo Cautionary Radius (1.2 km). High traffic/incident bottleneck.</p>
        <span style="font-size:11px; color:#64748b;">Safety Score: ${zone.safety}/5 (Sample Data)</span>
      </div>
    `);

    state.markers.safetyCircles.push(circle);

    // Marker pin
    const pin = L.marker([zone.lat, zone.lng], { icon: createCustomPin('safety') }).addTo(state.maps.safety);
    pin.bindPopup(`<strong>${escapeHTML(zone.name)}</strong><br>Caution Zone`);
  });

  // Also add regular place markers lightly
  state.places.filter(p => p.category !== 'safety').forEach(p => {
    const pin = L.marker([p.lat, p.lng], { icon: createCustomPin(p.category) }).addTo(state.maps.safety);
    pin.bindPopup(`<strong>${escapeHTML(p.name)}</strong>`);
  });
}

function initSafetyRouteHelper() {
  const originSelect = document.getElementById('routeOriginSelect');
  const destSelect = document.getElementById('routeDestSelect');
  const checkBtn = document.getElementById('checkRouteBtn');
  const clearBtn = document.getElementById('clearRouteBtn');
  const banner = document.getElementById('routeResultBanner');

  if (!originSelect || !destSelect) return;

  // Populate dropdowns excluding pure caution zones
  const validPlaces = state.places.filter(p => p.category !== 'safety');
  const optionsHtml = validPlaces.map(p => `<option value="${p.id}">${escapeHTML(p.name)} (${CATEGORY_CONFIG[p.category]?.label || p.category})</option>`).join('');

  originSelect.innerHTML = `<option value="">Select origin...</option>` + optionsHtml;
  destSelect.innerHTML = `<option value="">Select destination...</option>` + optionsHtml;

  checkBtn?.addEventListener('click', () => {
    const origId = parseInt(originSelect.value, 10);
    const destId = parseInt(destSelect.value, 10);

    if (!origId || !destId) {
      alert('Please select both a starting location and a destination.');
      return;
    }
    if (origId === destId) {
      alert('Starting location and destination cannot be identical.');
      return;
    }

    const origPlace = state.places.find(p => p.id === origId);
    const destPlace = state.places.find(p => p.id === destId);
    if (!origPlace || !destPlace) return;

    if (!state.maps.safety) initSafetyMap();

    // Proximity check against caution zones
    const cautionZones = state.places.filter(p => p.category === 'safety');
    const PROXIMITY_THRESHOLD_KM = 1.3; // km

    const interceptedZones = [];
    cautionZones.forEach(zone => {
      const dist = pointToSegmentDistanceKm(
        zone.lat, zone.lng,
        origPlace.lat, origPlace.lng,
        destPlace.lat, destPlace.lng
      );
      if (dist <= PROXIMITY_THRESHOLD_KM) {
        interceptedZones.push({ zone, dist: Math.round(dist * 10) / 10 });
      }
    });

    const hasInterception = interceptedZones.length > 0;
    const lineColor = hasInterception ? '#dc2626' : '#16a34a';

    // Remove existing line
    if (state.markers.routeLine) {
      state.markers.routeLine.remove();
      state.markers.routeLine = null;
    }

    // Try fetching real street routing from free public OSRM engine
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origPlace.lng},${origPlace.lat};${destPlace.lng},${destPlace.lat}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
      .then(res => res.json())
      .then(data => {
        let routeDistanceKm = null;
        let routeDurationMins = null;

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          routeDistanceKm = (route.distance / 1000).toFixed(1);
          routeDurationMins = Math.round(route.duration / 60);

          // Convert GeoJSON coords [lng, lat] to Leaflet [lat, lng]
          const latlngs = route.geometry.coordinates.map(c => [c[1], c[0]]);

          state.markers.routeLine = L.polyline(latlngs, {
            color: lineColor,
            weight: 5,
            opacity: 0.85
          }).addTo(state.maps.safety);
        } else {
          // Fallback to straight line
          drawFallbackStraightLine();
        }

        updateRouteBanner(routeDistanceKm, routeDurationMins);
      })
      .catch(err => {
        // Fallback to straight line seamlessly if OSRM is unreachable
        console.info('OSRM offline or rate-limited; falling back to direct line', err);
        drawFallbackStraightLine();
        updateRouteBanner(null, null);
      });

    function drawFallbackStraightLine() {
      state.markers.routeLine = L.polyline(
        [[origPlace.lat, origPlace.lng], [destPlace.lat, destPlace.lng]],
        { color: lineColor, weight: 5, dashArray: hasInterception ? '6, 8' : null }
      ).addTo(state.maps.safety);
    }

    function updateRouteBanner(distKm, durMins) {
      if (state.markers.routeLine) {
        state.maps.safety.fitBounds(state.markers.routeLine.getBounds(), { padding: [40, 40] });
      }

      banner.classList.remove('hidden');
      const distInfoHtml = distKm ? `<div class="route-distance-chip">🛣️ Road Distance: ${distKm} km &bull; ⏱️ ~${durMins} mins driving</div>` : '';

      if (hasInterception) {
        const zoneNames = interceptedZones.map(item => `<strong>${escapeHTML(item.zone.name)}</strong> (~${item.dist} km)`).join(', ');
        banner.className = 'route-result-banner route-warning';
        banner.innerHTML = `
          <strong>⚠️ Cautionary Proximity Alert:</strong>
          <p>This route passes in proximity of high-congestion caution zone(s): ${zoneNames}. Exercise heightened alertness during rush hours.</p>
          ${distInfoHtml}
          <small style="display:block; margin-top:5px; opacity:0.85;">*Street route mapped via OpenStreetMap/OSRM road network.</small>
        `;
      } else {
        banner.className = 'route-result-banner route-safe';
        banner.innerHTML = `
          <strong>✅ Clear & Safe Corridor Detected:</strong>
          <p>The route between ${escapeHTML(origPlace.name)} and ${escapeHTML(destPlace.name)} does not cross near sample accident or bottleneck zones.</p>
          ${distInfoHtml}
          <small style="display:block; margin-top:5px; opacity:0.85;">*Real road polyline plotted via OpenStreetMap road network.</small>
        `;
      }
    }
  });

  clearBtn?.addEventListener('click', () => {
    originSelect.value = '';
    destSelect.value = '';
    if (state.markers.routeLine) {
      state.markers.routeLine.remove();
      state.markers.routeLine = null;
    }
    banner.classList.add('hidden');
    if (state.maps.safety) {
      state.maps.safety.setView(PUNE_CENTER, DEFAULT_ZOOM);
    }
  });
}

// Distance math helpers
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function pointToSegmentDistanceKm(px, py, x1, y1, x2, y2) {
  // Approximate projection on local tangent
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return haversineDistanceKm(px, py, x1, y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return haversineDistanceKm(px, py, projX, projY);
}

// ==========================================================================
// TAB 4: Citizen Reports (localStorage & Map Location Selection)
// ==========================================================================
function initCitizenReports() {
  loadSavedReports();
  initReportForm();
}

function initReportMap() {
  const mapEl = document.getElementById('reportMap');
  if (!mapEl || state.maps.report) return;

  state.maps.report = L.map('reportMap', {
    center: PUNE_CENTER,
    zoom: 12
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.maps.report);

  // Click on map to pick location
  state.maps.report.on('click', (e) => {
    const { lat, lng } = e.latlng;
    setReportPickedLocation(lat, lng);
  });

  // Render existing report pins
  renderReportPins();
}

function setReportPickedLocation(lat, lng) {
  state.tempReportCoord = { lat, lng };

  // Update UI badge & text
  const badge = document.getElementById('reportLocationBadge');
  const coordsText = document.getElementById('selectedCoordsText');
  if (badge) {
    badge.textContent = '✓ Location Selected';
    badge.classList.add('selected');
  }
  if (coordsText) {
    coordsText.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  // Update pin
  if (!state.markers.reportPicker) {
    state.markers.reportPicker = L.marker([lat, lng], {
      icon: createReportPin()
    }).addTo(state.maps.report);
  } else {
    state.markers.reportPicker.setLatLng([lat, lng]);
  }
}

function initReportForm() {
  const form = document.getElementById('citizenReportForm');
  const resetBtn = document.getElementById('resetReportFormBtn');
  const alertBox = document.getElementById('reportFormAlert');

  // Photo handlers
  const photoInput = document.getElementById('reportPhotoInput');
  const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
  const photoNameHint = document.getElementById('photoNameHint');
  const photoPreviewWrap = document.getElementById('photoPreviewWrap');
  const photoPreviewImg = document.getElementById('photoPreviewImg');
  const removePhotoBtn = document.getElementById('removePhotoBtn');

  uploadPhotoBtn?.addEventListener('click', () => {
    photoInput?.click();
  });

  photoInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showReportAlert('Please select an image file (JPG, PNG, WebP).', 'error');
      return;
    }

    // Limit size to 2MB to keep localStorage healthy
    if (file.size > 2.5 * 1024 * 1024) {
      showReportAlert('Please choose an image under 2.5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      state.tempPhotoBase64 = loadEvent.target.result;
      if (photoPreviewImg) photoPreviewImg.src = state.tempPhotoBase64;
      if (photoPreviewWrap) photoPreviewWrap.classList.remove('hidden');
      if (photoNameHint) photoNameHint.textContent = file.name;
    };
    reader.readAsDataURL(file);
  });

  removePhotoBtn?.addEventListener('click', () => {
    resetPhotoInput();
  });

  // Voice Note Recorder handlers
  const recordVoiceBtn = document.getElementById('recordVoiceBtn');
  const recordBtnLabel = document.getElementById('recordBtnLabel');
  const recordingTimer = document.getElementById('recordingTimer');
  const recordingPulse = document.getElementById('recordingPulse');
  const audioPreviewWrap = document.getElementById('audioPreviewWrap');
  const audioPlayback = document.getElementById('audioPlayback');
  const removeAudioBtn = document.getElementById('removeAudioBtn');

  recordVoiceBtn?.addEventListener('click', async () => {
    // If currently recording, stop it
    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
      stopVoiceRecording();
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startVoiceRecording(stream);
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      showReportAlert('Microphone permission required to record audio note.', 'error');
    }
  });

  removeAudioBtn?.addEventListener('click', () => {
    resetAudioInput();
  });

  function startVoiceRecording(stream) {
    state.audioChunks = [];
    state.recordingSeconds = 0;

    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
    }

    try {
      state.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (e) {
      state.mediaRecorder = new MediaRecorder(stream);
    }

    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        state.audioChunks.push(event.data);
      }
    };

    state.mediaRecorder.onstop = () => {
      const audioBlob = new Blob(state.audioChunks, { type: state.mediaRecorder.mimeType || 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        state.tempAudioBase64 = reader.result;
        if (audioPlayback) {
          audioPlayback.src = state.tempAudioBase64;
        }
        if (audioPreviewWrap) audioPreviewWrap.classList.remove('hidden');
      };
      reader.readAsDataURL(audioBlob);

      // Stop mic tracks
      stream.getTracks().forEach(track => track.stop());
    };

    state.mediaRecorder.start();

    // UI Updates
    if (recordBtnLabel) recordBtnLabel.textContent = 'Stop Recording';
    if (recordingTimer) {
      recordingTimer.textContent = '00:00';
      recordingTimer.classList.remove('hidden');
    }
    if (recordingPulse) recordingPulse.classList.remove('hidden');
    if (recordVoiceBtn) recordVoiceBtn.classList.add('btn-primary');

    // Timer Interval
    clearInterval(state.recordingInterval);
    state.recordingInterval = setInterval(() => {
      state.recordingSeconds++;
      const mins = String(Math.floor(state.recordingSeconds / 60)).padStart(2, '0');
      const secs = String(state.recordingSeconds % 60).padStart(2, '0');
      if (recordingTimer) recordingTimer.textContent = `${mins}:${secs}`;

      // Max 60 seconds auto-stop
      if (state.recordingSeconds >= 60) {
        stopVoiceRecording();
      }
    }, 1000);
  }

  function stopVoiceRecording() {
    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
      state.mediaRecorder.stop();
    }
    clearInterval(state.recordingInterval);

    // UI Updates
    if (recordBtnLabel) recordBtnLabel.textContent = 'Record Again';
    if (recordingTimer) recordingTimer.classList.add('hidden');
    if (recordingPulse) recordingPulse.classList.add('hidden');
    if (recordVoiceBtn) recordVoiceBtn.classList.remove('btn-primary');
  }

  function resetPhotoInput() {
    state.tempPhotoBase64 = null;
    if (photoInput) photoInput.value = '';
    if (photoPreviewImg) photoPreviewImg.src = '';
    if (photoPreviewWrap) photoPreviewWrap.classList.add('hidden');
    if (photoNameHint) photoNameHint.textContent = 'No photo attached';
  }

  function resetAudioInput() {
    state.tempAudioBase64 = null;
    if (audioPlayback) {
      audioPlayback.pause();
      audioPlayback.src = '';
    }
    if (audioPreviewWrap) audioPreviewWrap.classList.add('hidden');
    if (recordBtnLabel) recordBtnLabel.textContent = 'Start Recording';
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const typeSelect = document.getElementById('reportTypeSelect');
    const descInput = document.getElementById('reportDescInput');

    const type = typeSelect.value.trim();
    const desc = descInput.value.trim();

    // Validation
    if (!type) {
      showReportAlert('Please select a report category.', 'error');
      typeSelect.focus();
      return;
    }

    if (!desc) {
      showReportAlert('Please enter a brief description of the issue.', 'error');
      descInput.focus();
      return;
    }

    if (!state.tempReportCoord) {
      showReportAlert('Please click on the map above to select the incident location.', 'error');
      return;
    }

    // Stop active recording if left on
    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
      stopVoiceRecording();
    }

    // Run client-side NLP analyzer
    const analysis = analyzeReportText(desc, type);

    // Create Report Object with analysis, photo and audio
    const newReport = {
      id: Date.now(),
      type: type,
      description: desc,
      photo: state.tempPhotoBase64 || null,
      audio: state.tempAudioBase64 || null,
      lat: state.tempReportCoord.lat,
      lng: state.tempReportCoord.lng,
      date: new Date().toISOString(),
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      analysis: analysis
    };

    // Save
    state.reports.unshift(newReport);
    try {
      localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(state.reports));
    } catch (err) {
      console.warn('LocalStorage save failed:', err);
      // If quota exceeded due to large photo, save without photo
      if (err.name === 'QuotaExceededError') {
        newReport.photo = null;
        localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(state.reports));
      }
    }

    showReportAlert('Report submitted successfully! Automated keyword screening generated.', 'success');

    // Reset Form fields
    form.reset();
    resetReportLocationPicker();
    resetPhotoInput();
    resetAudioInput();
    renderReportsList();
    renderReportPins();
  });

  resetBtn?.addEventListener('click', () => {
    form.reset();
    resetReportLocationPicker();
    resetPhotoInput();
    resetAudioInput();
    alertBox?.classList.add('hidden');
  });
}

function resetReportLocationPicker() {
  state.tempReportCoord = null;
  const badge = document.getElementById('reportLocationBadge');
  const coordsText = document.getElementById('selectedCoordsText');
  if (badge) {
    badge.textContent = '📍 Tap the map to set pin';
    badge.classList.remove('selected');
  }
  if (coordsText) {
    coordsText.textContent = 'None chosen yet';
  }
  if (state.markers.reportPicker && state.maps.report) {
    state.markers.reportPicker.remove();
    state.markers.reportPicker = null;
  }
}

function showReportAlert(msg, type) {
  const alertBox = document.getElementById('reportFormAlert');
  if (!alertBox) return;
  alertBox.className = `form-alert ${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => {
      alertBox.classList.add('hidden');
    }, 4500);
  }
}

function loadSavedReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPORTS);
    if (raw) {
      state.reports = JSON.parse(raw);
    } else {
      // Seed initial sample demo report for empty state richness
      state.reports = [
        {
          id: 101,
          type: 'Traffic',
          description: 'Recurring bottleneck near Deccan Gymkhana during evening peak hours (6-8 PM).',
          lat: 18.5175,
          lng: 73.8420,
          timestamp: 'Sample Demo Report'
        }
      ];
      localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(state.reports));
    }
  } catch (e) {
    state.reports = [];
  }
  renderReportsList();
}

// ==========================================================================
// Client-Side NLP Rule-Based Analyzer for Citizen Reports
// (Automated keyword screening · Rule confidence · Needs human verification)
// ==========================================================================
const NLP_RULES = [
  {
    category: "Safety",
    keywords: [
      "fire",
      "आग",
      "blood",
      "खून",
      "dead",
      "death",
      "injury",
      "घायल"
    ],
    urgency: 5,
    sentiment: "Critical",
    tag: "🚨 Critical",
    confidence: 94
  },
  {
    category: "Safety",
    keywords: [
      "dark",
      "अंधेरा",
      "harassment",
      "theft",
      "चोरी",
      "unsafe",
      "danger"
    ],
    urgency: 4,
    sentiment: "Negative",
    tag: "⚠️ Urgent",
    confidence: 89
  },
  {
    category: "Traffic",
    keywords: [
      "accident",
      "अपघात",
      "crash",
      "traffic",
      "jam",
      "congestion",
      "signal"
    ],
    urgency: 4,
    sentiment: "Negative",
    tag: "🚧 High Priority",
    confidence: 91
  },
  {
    category: "Infrastructure",
    keywords: [
      "pothole",
      "खड्डा",
      "broken road",
      "road damage",
      "streetlight"
    ],
    urgency: 3,
    sentiment: "Concern",
    tag: "🛠️ Needs Attention",
    confidence: 86
  },
  {
    category: "Cleanliness",
    keywords: [
      "garbage",
      "कचरा",
      "dirty",
      "smell",
      "waste",
      "litter"
    ],
    urgency: 2,
    sentiment: "Concern",
    tag: "🧹 Cleanliness Issue",
    confidence: 84
  }
];

function analyzeReportText(text, selectedType) {
  const combinedText = `${text || ''} ${selectedType || ''}`.toLowerCase();

  const matchedRules = [];
  const allMatchedKeywords = new Set();

  NLP_RULES.forEach(rule => {
    const foundKeywords = rule.keywords.filter(kw => combinedText.includes(kw.toLowerCase()));
    if (foundKeywords.length > 0) {
      foundKeywords.forEach(kw => allMatchedKeywords.add(kw));
      matchedRules.push(rule);
    }
  });

  const matchedKeywords = Array.from(allMatchedKeywords);

  if (matchedRules.length === 0) {
    return {
      category: selectedType || "General",
      sentiment: "Neutral",
      urgency: 1,
      priority: "Normal",
      tag: "ℹ️ General Report",
      confidence: 72,
      matchedKeywords: [],
      status: "Needs human verification"
    };
  }

  // Strongest matching rule based on highest urgency
  matchedRules.sort((a, b) => b.urgency - a.urgency);
  const strongestRule = matchedRules[0];

  // Calculate average confidence across matched rules
  const avgConfidence = Math.round(
    matchedRules.reduce((sum, r) => sum + r.confidence, 0) / matchedRules.length
  );

  // Expected priority mapping
  let priority = "Normal";
  if (strongestRule.urgency >= 5) priority = "Critical";
  else if (strongestRule.urgency === 4) priority = "Urgent";
  else if (strongestRule.urgency === 3) priority = "Medium";
  else priority = "Low";

  return {
    category: strongestRule.category,
    sentiment: strongestRule.sentiment,
    urgency: strongestRule.urgency,
    priority: priority,
    tag: strongestRule.tag,
    confidence: avgConfidence,
    matchedKeywords: matchedKeywords,
    status: "Needs human verification"
  };
}

function renderReportsList() {
  const container = document.getElementById('reportsListContainer');
  const countPill = document.getElementById('reportsCountPill');
  if (!container) return;

  if (countPill) {
    countPill.textContent = `${state.reports.length} Reports`;
  }

  // Update Analytics Dashboard
  renderReportAnalyticsDashboard();

  if (state.reports.length === 0) {
    container.innerHTML = `
      <div class="empty-state card">
        <div class="empty-state-icon">📢</div>
        <h4 class="empty-state-title">No citizen reports recorded</h4>
        <p class="empty-state-text">Be the first to submit a community safety alert using the form on the left.</p>
      </div>
    `;
    return;
  }

  const badgeClassMap = {
    'Unsafe area': 'badge-unsafe',
    'Accident': 'badge-accident',
    'Traffic': 'badge-traffic',
    'Cleanliness': 'badge-cleanliness'
  };

  container.innerHTML = state.reports.map(r => {
    let mediaHtml = '';
    if (r.photo) {
      mediaHtml += `<div class="report-attached-media"><img src="${r.photo}" alt="Report photo attachment" class="report-photo-thumb"></div>`;
    }
    if (r.audio) {
      mediaHtml += `<div class="report-attached-media"><audio controls src="${r.audio}" class="report-audio-player"></audio></div>`;
    }

    // Safe fallback for older reports without analysis object
    const analysis = r.analysis || analyzeReportText(r.description, r.type);

    const priorityClass = `priority-${(analysis.priority || 'normal').toLowerCase()}`;
    const matchedKwsHtml = analysis.matchedKeywords && analysis.matchedKeywords.length > 0
      ? `<div class="nlp-keywords-row">
           <span style="color:#64748b; font-size:0.72rem;">Matched keywords:</span>
           ${analysis.matchedKeywords.map(kw => `<span class="nlp-kw-chip">${escapeHTML(kw)}</span>`).join('')}
         </div>`
      : '';

    return `
      <div class="report-item-card">
        <div class="report-meta-row">
          <span class="report-type-badge ${badgeClassMap[r.type] || 'badge-unsafe'}">${escapeHTML(r.type)}</span>
          <span>${escapeHTML(r.timestamp || r.date || 'Recent')}</span>
        </div>

        <!-- NLP Analysis Card Metadata -->
        <div class="nlp-report-meta-box">
          <div class="nlp-meta-top-row">
            <span class="nlp-tag-badge">${escapeHTML(analysis.tag || 'ℹ️ General Report')}</span>
            <span class="nlp-priority-badge ${priorityClass}">${escapeHTML(analysis.priority || 'Normal')}</span>
          </div>
          <div class="nlp-meta-details-row">
            <span>Category: <strong>${escapeHTML(analysis.category || 'General')}</strong></span>
            <span>Priority: <strong>${escapeHTML(analysis.priority || 'Normal')}</strong></span>
            <span>Rule confidence: <strong>${analysis.confidence || 72}%</strong></span>
          </div>
          ${matchedKwsHtml}
          <div class="nlp-status-note">
            <span>Status: ${escapeHTML(analysis.status || 'Needs human verification')}</span>
          </div>
        </div>

        <p class="report-desc-text">${escapeHTML(r.description)}</p>
        ${mediaHtml}
        <div class="report-coords-text">Location: ${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}</div>
      </div>
    `;
  }).join('');
}

// Generate Citizen Report Analytics Dashboard
function renderReportAnalyticsDashboard() {
  const totalVal = document.getElementById('nlpTotalReportsVal');
  const topCatVal = document.getElementById('nlpTopCategoryVal');
  const urgentCountVal = document.getElementById('nlpUrgentCountVal');
  const breakdownContainer = document.getElementById('nlpBreakdownContainer');

  if (!breakdownContainer) return;

  const total = state.reports.length;
  if (totalVal) totalVal.textContent = total;

  if (total === 0) {
    if (topCatVal) topCatVal.textContent = 'None';
    if (urgentCountVal) urgentCountVal.textContent = '0';
    breakdownContainer.innerHTML = `
      <div class="nlp-empty-hint">
        No reports yet. Submit a report to generate NLP insights.
      </div>
    `;
    return;
  }

  // Count categories and urgent reports
  const categoryCounts = {};
  let urgentCriticalCount = 0;

  state.reports.forEach(r => {
    const analysis = r.analysis || analyzeReportText(r.description, r.type);
    const cat = analysis.category || r.type || 'General';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    const pri = (analysis.priority || '').toLowerCase();
    if (pri === 'critical' || pri === 'urgent' || (analysis.urgency && analysis.urgency >= 4)) {
      urgentCriticalCount++;
    }
  });

  if (urgentCountVal) urgentCountVal.textContent = urgentCriticalCount;

  // Determine top category
  let topCategory = 'General';
  let topCount = 0;
  for (const [cat, count] of Object.entries(categoryCounts)) {
    if (count > topCount) {
      topCount = count;
      topCategory = cat;
    }
  }
  if (topCatVal) topCatVal.textContent = topCategory;

  // Build sorted category progress bars
  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  breakdownContainer.innerHTML = sortedCategories.map(([cat, count]) => {
    const pct = Math.round((count / total) * 100);
    const fillClass = `fill-${cat.toLowerCase()}`;
    return `
      <div class="nlp-progress-item">
        <div class="nlp-progress-label-row">
          <span>${escapeHTML(cat)}</span>
          <span>${pct}% (${count})</span>
        </div>
        <div class="nlp-progress-track">
          <div class="nlp-progress-fill ${fillClass}" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderReportPins() {
  if (!state.maps.report) return;

  // Clear existing feed markers
  state.markers.reportFeedMarkers.forEach(m => m.remove());
  state.markers.reportFeedMarkers = [];

  state.reports.forEach(r => {
    const pin = L.marker([r.lat, r.lng], { icon: createReportPin() }).addTo(state.maps.report);
    let popupMedia = '';
    if (r.photo) {
      popupMedia += `<div style="margin-top:4px;"><img src="${r.photo}" style="max-width:100%; max-height:80px; border-radius:4px; display:block;"></div>`;
    }
    if (r.audio) {
      popupMedia += `<div style="margin-top:4px;"><audio controls src="${r.audio}" style="width:100%; height:26px;"></audio></div>`;
    }

    pin.bindPopup(`
      <div style="font-size:12px; max-width:200px;">
        <strong style="color:#0f172a;">${escapeHTML(r.type)}</strong>
        <p style="margin:3px 0; color:#334155;">${escapeHTML(r.description)}</p>
        ${popupMedia}
        <span style="font-size:10px; color:#64748b; display:block; margin-top:3px;">${escapeHTML(r.timestamp)}</span>
      </div>
    `);
    state.markers.reportFeedMarkers.push(pin);
  });
}

// ==========================================================================
// TAB 5: Plan My Day (Rule-Based Itinerary Generator)
// ==========================================================================
function initPlanMyDay() {
  const form = document.getElementById('planDayForm');
  const budgetSlider = document.getElementById('planBudgetSlider');
  const budgetDisplay = document.getElementById('planBudgetDisplay');
  const resultContainer = document.getElementById('itineraryResultContainer');

  budgetSlider?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    budgetDisplay.textContent = `₹${val.toLocaleString('en-IN')}`;
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    generateItinerary();
  });

  // Render initial guidance empty state
  if (resultContainer) {
    resultContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🧭</div>
        <h3 class="empty-state-title">Ready to explore Pune?</h3>
        <p class="empty-state-text">Adjust your budget and select your preferred interests on the left, then click <strong>"Create Itinerary"</strong> to generate your tailored day schedule.</p>
      </div>
    `;
  }
}

function generateItinerary() {
  const budgetSlider = document.getElementById('planBudgetSlider');
  const resultContainer = document.getElementById('itineraryResultContainer');
  if (!budgetSlider || !resultContainer) return;

  const budget = parseInt(budgetSlider.value, 10);

  // Collect checked interests
  const checkedBoxes = document.querySelectorAll('input[name="interest"]:checked');
  const selectedCategories = Array.from(checkedBoxes).map(cb => cb.value);

  if (selectedCategories.length === 0) {
    resultContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h4 class="empty-state-title">Please choose at least one interest</h4>
        <p class="empty-state-text">Select one or more categories (e.g. Heritage, Food, Attractions) to generate an itinerary.</p>
      </div>
    `;
    return;
  }

  // Filter places rule-based:
  // 1. Matches selected category
  // 2. Excludes unsafe zones
  // 3. Excludes places where avgPrice > budget
  // 4. Sorts by rating descending
  const candidates = state.places
    .filter(p => selectedCategories.includes(p.category))
    .filter(p => p.category !== 'safety')
    .filter(p => p.avgPrice <= budget)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5); // Up to 5 recommended places

  if (candidates.length === 0) {
    resultContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏖️</div>
        <h4 class="empty-state-title">No matching places within this budget</h4>
        <p class="empty-state-text">No places matched your chosen interests within ₹${budget.toLocaleString('en-IN')}. Try expanding your interest selection or raising your budget ceiling.</p>
      </div>
    `;
    return;
  }

  // Total estimated cost
  const totalCost = candidates.reduce((sum, p) => sum + p.avgPrice, 0);

  let html = `
    <div class="itinerary-summary-bar">
      <div>
        <h3 style="font-size:1.15rem; color:#0f172a; margin-bottom:2px;">Custom Pune Itinerary (${candidates.length} Stops)</h3>
        <span style="font-size:0.82rem; color:#64748b;">Sorted by top visitor ratings &bull; Safety verified</span>
      </div>
      <div style="text-align: right;">
        <span style="font-size:0.75rem; color:#64748b; display:block;">Est. Total Day Cost</span>
        <strong style="font-size:1.1rem; color:#2563eb;">₹${totalCost.toLocaleString('en-IN')}</strong>
      </div>
    </div>

    <div class="itinerary-items-timeline">
  `;

  candidates.forEach((place, idx) => {
    const costText = place.avgPrice === 0 ? 'Free' : `₹${place.avgPrice}`;
    html += `
      <div class="timeline-stop-card">
        <div class="timeline-node-pin"></div>
        <div class="timeline-stop-header">
          <div>
            <span style="font-size:0.75rem; font-weight:700; color:#2563eb; text-transform:uppercase; letter-spacing:0.04em;">Stop ${idx + 1} &bull; ${CATEGORY_CONFIG[place.category]?.label || place.category}</span>
            <h4 class="timeline-title">${escapeHTML(place.name)}</h4>
          </div>
          <button type="button" class="timeline-action-btn" onclick="window.viewPlaceFromPlan(${place.id})">
            View on Map ↗
          </button>
        </div>
        <p style="font-size:0.86rem; color:#334155; margin:0.25rem 0;">${escapeHTML(place.description)}</p>
        <div style="font-size:0.78rem; color:#64748b; display:flex; gap:0.75rem;">
          <span>⭐ <strong>${place.rating}</strong>/5</span>
          <span>💵 Est: <strong>${costText}</strong></span>
          <span>🛡️ Safety: <strong>${place.safety}</strong>/5</span>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  resultContainer.innerHTML = html;
}

// Switch to Explore tab and inspect place
window.viewPlaceFromPlan = function(placeId) {
  switchTab('explore');
  setTimeout(() => {
    selectPlace(placeId, true);
  }, 150);
};

// ==========================================================================
// Social Media City Pulse (Twitter/X & Crowdsourced Social Insights)
// ==========================================================================
const PUNE_SOCIAL_FEED = [
  {
    id: 1,
    tag: 'traffic',
    handle: '@PuneTrafficPoliceUpdates',
    time: '12m ago',
    text: '⚠️ #PuneTraffic Slow vehicular movement reported between Swargate and Sarasbaug due to ongoing road surface maintenance. Plan alternate Peth routes.',
    likes: 84,
    retweets: 31
  },
  {
    id: 2,
    tag: 'weather',
    handle: '@PuneWeatherPulse',
    time: '25m ago',
    text: '🌧️ #PuneRains Sudden afternoon overcast skies over Sinhagad Fort & Katraj Ghat. Pleasant 24°C breeze. Carry light rainwear if trekking!',
    likes: 142,
    retweets: 48
  },
  {
    id: 3,
    tag: 'food',
    handle: '@PuneFoodWalks',
    time: '38m ago',
    text: '☕ #FoodCulture Weekend rush is on at FC Road! Vaishali SPDP and Vohuman bun maska queues moving briskly. Prime Puneri cafe vibe today.',
    likes: 219,
    retweets: 63
  },
  {
    id: 4,
    tag: 'traffic',
    handle: '@PuneriCommuter',
    time: '45m ago',
    text: '🚗 #PuneTraffic Yerawada junction signal timing synchronized by PMC traffic team. Commute flow toward Viman Nagar looking significantly smoother.',
    likes: 56,
    retweets: 12
  },
  {
    id: 5,
    tag: 'weather',
    handle: '@PashanBirdersClub',
    time: '1h ago',
    text: '🪶 #PuneOutdoors Clear skies and misty waters at Pashan Lake this morning. Perfect lighting for migratory bird photography.',
    likes: 97,
    retweets: 24
  },
  {
    id: 6,
    tag: 'food',
    handle: '@DeccanEats',
    time: '2h ago',
    text: '🥧 #FoodCulture Tried hot mutton keema & bun maska at Goodluck Cafe Deccan. 85+ years of pure nostalgic Pune heritage!',
    likes: 180,
    retweets: 39
  }
];

function initSocialPulse() {
  const modal = document.getElementById('socialModalOverlay');
  const openBtn = document.getElementById('toggleSocialModalBtn');
  const closeBtn = document.getElementById('closeSocialModalBtn');
  const container = document.getElementById('socialPostsContainer');
  const filterBtns = document.querySelectorAll('.social-filters-row .pill-btn');

  let activeSocialFilter = 'all';

  function renderSocialPosts(filter = 'all') {
    if (!container) return;
    const filtered = filter === 'all' ? PUNE_SOCIAL_FEED : PUNE_SOCIAL_FEED.filter(p => p.tag === filter);

    container.innerHTML = filtered.map(post => `
      <div class="social-post-card">
        <div class="social-post-top">
          <span class="social-user-handle">${escapeHTML(post.handle)}</span>
          <span>${escapeHTML(post.time)}</span>
        </div>
        <p class="social-post-text">${escapeHTML(post.text)}</p>
        <div class="social-post-stats">
          <span>❤️ ${post.likes} Likes</span>
          <span>🔁 ${post.retweets} Reposts</span>
        </div>
      </div>
    `).join('');
  }

  openBtn?.addEventListener('click', () => {
    modal?.classList.remove('hidden');
    renderSocialPosts(activeSocialFilter);
  });

  closeBtn?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSocialFilter = btn.getAttribute('data-social') || 'all';
      renderSocialPosts(activeSocialFilter);
    });
  });

  // Render initial posts
  renderSocialPosts('all');
}

// Hook into DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initSocialPulse();
});
