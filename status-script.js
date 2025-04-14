// --- Configuration & State ---
const statusDataURL = 'status-data.json';
const geojsonURL = 'lpa_map.geojson'; // Path to your GeoJSON file
const currentYear = new Date().getFullYear();
let allLpaData = []; // De-duplicated status data
let filteredLpaData = [];
let map = null;
let geojsonLayer = null; // To store the map layer
let lpaLayerMapping = {}; // To quickly reference layers by LPA ID
let sortColumn = 'name';
let sortDirection = 'asc';

// NEW: Global variable to track Tilted Balance Mode state
let tiltedBalanceMode = false;

// --- DOM Elements ---
let tableBody, tableHead, searchInput, regionFilter, statusFilter, riskFilter, tiltedBalanceToggle;
let detailsPanel, detailsLpaName, detailsPlanStatus, detailsRiskScore, detailsYearsSince;
let detailsUpdateProgress, detailsNppfDefault, detailsNotes, detailsReferences, closeDetailsBtn;
let statAdoptedRecent, statJustAdopted, statAdoptedOutdated, statEmerging, statWithdrawn;
let exportCsvBtn, mapContainer, lpaCardsContainer;

// --- Status Code to Color Mapping ---
const statusColors = {
  'adopted_recent': '#329c85',         // Soft green
  'just_adopted_updating': '#5bc0de',    // Calm teal
  'adopted_outdated': '#f5c315',         // Yellow
  'emerging_in_progress': '#f0ad4e',     // Orange
  'withdrawn_or_vacuum': '#d9534f',      // Red
  'default': '#cccccc'                   // Default grey for missing/unknown
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed.");
  assignDOMElements();
  if (!checkCriticalElements()) return;
  initializeMapStructure();
  Promise.all([
    fetchStatusData(statusDataURL),
    fetchGeojsonData(geojsonURL)
  ])
    .then(([rawStatusData, geojsonData]) => {
      console.log("Both status and GeoJSON data fetched successfully.");
      processAndInitializeDashboard(rawStatusData, geojsonData);
    })
    .catch(error => {
      console.error("Error fetching initial data:", error);
      displayLoadingError("Error loading dashboard data. Please try again later.");
    });

  // --- Modal Logic ---
  const introModal = document.getElementById('intro-modal');
  const closeIntroBtn = document.getElementById('close-intro-modal');
  if (introModal && closeIntroBtn) {
    const hasSeenIntro = localStorage.getItem('hasSeenIntroModal');
    if (!hasSeenIntro) {
      introModal.classList.remove('hidden');
      introModal.style.display = 'flex';
    }
    closeIntroBtn.addEventListener('click', () => {
      introModal.classList.add('hidden');
      introModal.style.display = 'none';
      localStorage.setItem('hasSeenIntroModal', 'true');
    });
  }

  // --- Floating Help Button Logic ---
  const helpButton = document.getElementById('help-button');
  if (helpButton) {
    helpButton.addEventListener('click', () => {
      const modal = document.getElementById('intro-modal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
    });
  }
});

/** Assigns global DOM element variables */
function assignDOMElements() {
  tableBody = document.getElementById('status-table-body');
  tableHead = document.getElementById('lpa-table-head');
  searchInput = document.getElementById('search-lpa');
  regionFilter = document.getElementById('region-filter');
  statusFilter = document.getElementById('status-filter');
  riskFilter = document.getElementById('risk-filter');
  // NEW: Tilted Balance toggle assignment
  tiltedBalanceToggle = document.getElementById('tilted-balance-toggle');
  detailsPanel = document.getElementById('selected-authority-details');
  detailsLpaName = document.getElementById('details-lpa-name');
  detailsPlanStatus = document.getElementById('details-plan-status');
  detailsRiskScore = document.getElementById('details-risk-score');
  detailsYearsSince = document.getElementById('details-years-since');
  detailsUpdateProgress = document.getElementById('details-update-progress');
  detailsNppfDefault = document.getElementById('details-nppf-default');
  detailsNotes = document.getElementById('details-notes');
  detailsReferences = document.getElementById('details-references');
  closeDetailsBtn = document.getElementById('close-details-btn');
  statAdoptedRecent = document.getElementById('stat-adopted-recent');
  statJustAdopted = document.getElementById('stat-just-adopted');
  statAdoptedOutdated = document.getElementById('stat-adopted-outdated');
  statEmerging = document.getElementById('stat-emerging');
  statWithdrawn = document.getElementById('stat-withdrawn');
  exportCsvBtn = document.getElementById('export-csv-btn');
  mapContainer = document.getElementById('map-container');
  lpaCardsContainer = document.getElementById('lpa-cards-container');
}

/** Checks if critical DOM elements were found */
function checkCriticalElements() {
  const criticalElements = [
    tableBody, tableHead, searchInput, detailsPanel, detailsRiskScore,
    exportCsvBtn, mapContainer, lpaCardsContainer, closeDetailsBtn,
    statAdoptedRecent, statJustAdopted, statAdoptedOutdated, statEmerging, statWithdrawn
  ];
  if (criticalElements.some(el => !el)) {
    console.error("Dashboard init failed: Critical elements missing.");
    const container = document.querySelector('.container');
    if (container) {
      const errorMsg = document.createElement('p');
      errorMsg.className = 'error-message';
      errorMsg.style.margin = '20px';
      errorMsg.textContent = 'Error initializing dashboard components. Check console (F12).';
      const header = document.querySelector('.dashboard-header');
      if (header)
        header.parentNode.insertBefore(errorMsg, header.nextSibling);
      else
        container.prepend(errorMsg);
    }
    return false;
  }
  console.log("All critical DOM elements found.");
  return true;
}

/** Displays loading/error messages in main content areas */
function displayLoadingError(message, isError = true) {
  const messageClass = isError ? 'error-message' : 'info-message';
  if (tableBody) {
    const cols = tableBody.closest('table')?.querySelector('thead tr')?.cells.length || 5;
    tableBody.innerHTML = `<tr><td colspan="${cols}" class="${messageClass}">${message}</td></tr>`;
  }
  if (lpaCardsContainer) {
    lpaCardsContainer.innerHTML = `<p class="${messageClass}">${message}</p>`;
  }
  if (isError) {
    const stats = [statAdoptedRecent, statJustAdopted, statAdoptedOutdated, statEmerging, statWithdrawn];
    stats.forEach(stat => { if (stat) stat.textContent = 'ERR'; });
  }
}

// --- Data Fetching ---
/** Fetches and returns status data */
async function fetchStatusData(url) {
  console.log("Fetching status data...");
  displayLoadingError("Loading plan status data...", false);
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`HTTP error fetching status data! status: ${response.status}`);
  return await response.json();
}

/** Fetches and returns GeoJSON data */
async function fetchGeojsonData(url) {
  console.log("Fetching GeoJSON data...");
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`HTTP error fetching GeoJSON! status: ${response.status}`);
  return await response.json();
}

// --- Initialization Flow (after data is loaded) ---
/** Processes data and sets up the dashboard */
function processAndInitializeDashboard(rawStatusData, geojsonData) {
  console.log("Processing data and initializing dashboard...");
  console.log(`Received ${rawStatusData.length} raw status records.`);

  // --- De-duplication Step ---
  // For records with the same ID:
  // If the adoption years differ, choose the one with the more recent year.
  // If they are the same (or if missing), choose the last record in the file.
  const lpaMap = {};
  rawStatusData.forEach(lpa => {
    if (!lpa || !lpa.id) {
      console.warn("Skipping record with missing ID:", lpa);
      return;
    }
    const existingEntry = lpaMap[lpa.id];
    if (
      !existingEntry ||
      isMoreRecent(lpa.last_adoption_year, existingEntry.last_adoption_year) ||
      (lpa.last_adoption_year === existingEntry.last_adoption_year)
    ) {
      lpaMap[lpa.id] = lpa;
    }
  });
  const deDuplicatedStatusData = Object.values(lpaMap);
  console.log(`Reduced to ${deDuplicatedStatusData.length} unique/most recent status records.`);
  // --- End De-duplication Step ---

  // 1. Pre-process the de-duplicated Status Data
  allLpaData = deDuplicatedStatusData.map(lpa => {
    const processedLpa = { ...lpa };
    processedLpa.years_since_adoption = calculateYearsSince(processedLpa.last_adoption_year);
    processedLpa.plan_status_display = formatStatusCode(processedLpa.status_code);
    processedLpa.last_adoption_year = processedLpa.last_adoption_year ? parseInt(processedLpa.last_adoption_year, 10) : null;
    if (isNaN(processedLpa.last_adoption_year))
      processedLpa.last_adoption_year = null;
    processedLpa.plan_risk_score =
      (processedLpa.plan_risk_score !== null && processedLpa.plan_risk_score !== undefined)
        ? parseInt(processedLpa.plan_risk_score, 10)
        : null;
    if (isNaN(processedLpa.plan_risk_score))
      processedLpa.plan_risk_score = null;
    processedLpa.years_since_adoption =
      (typeof processedLpa.years_since_adoption === 'number')
        ? processedLpa.years_since_adoption
        : null;
    return processedLpa;
  });

  // 2. Create Lookup for the de-duplicated Status Data
  const lpaStatusLookup = createLpaStatusLookup(allLpaData);

  // 3. Merge de-duplicated Status Data into GeoJSON Features
  geojsonData.features.forEach(feature => {
    const lpaId = feature.properties.LPA23CD;
    const statusInfo = lpaStatusLookup[lpaId];
    if (statusInfo) {
      feature.properties.status_code = statusInfo.status_code;
      feature.properties.name = statusInfo.name;
      feature.properties.plan_status_display = statusInfo.plan_status_display;
      feature.properties.id = statusInfo.id;
      // NEW: Merge the nppf_defaulting flag
      feature.properties.nppf_defaulting = statusInfo.nppf_defaulting;
    } else {
      console.warn(`No status data found for GeoJSON feature LPA ID: ${lpaId} (Name: ${feature.properties.LPA23NM}) after de-duplication.`);
      feature.properties.status_code = 'unknown';
      feature.properties.name = feature.properties.LPA23NM || 'Unknown LPA';
      feature.properties.plan_status_display = 'Unknown';
      feature.properties.id = `geojson-${lpaId}`;
      feature.properties.nppf_defaulting = false;
    }
  });

  // 4. Add Map Overlay
  addMapOverlay(geojsonData);

  // 5. Populate Filters (based on de-duplicated data)
  populateFilters();

  // 6. Apply Initial Sort & Render Dashboard
  filteredLpaData = [...allLpaData];
  sortTableData();
  updateDashboard();

  // 7. Add Event Listeners
  addEventListeners();

  console.log("Dashboard initialization complete.");
}

/** Helper function to compare adoption years, handling nulls */
function isMoreRecent(yearA, yearB) {
  const numA = (typeof yearA === 'number' && !isNaN(yearA)) ? yearA : null;
  const numB = (typeof yearB === 'number' && !isNaN(yearB)) ? yearB : null;
  if (numA === null || numB === null) return false;
  return numA > numB;
}

/** Creates a lookup object for status data by LPA ID */
function createLpaStatusLookup(statusData) {
  const lookup = {};
  statusData.forEach(lpa => { lookup[lpa.id] = lpa; });
  return lookup;
}

// --- Map Functions ---
function initializeMapStructure() {
  try {
    map = L.map(mapContainer).setView([53.5, -1.5], 6); // Center on England/Wales
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      detectRetina: true
    }).addTo(map);
    console.log("Leaflet map structure initialized.");
    const placeholderVisual = mapContainer.querySelector('.map-placeholder-visual');
    const placeholderText = mapContainer.querySelector('.map-placeholder-text');
    if (placeholderVisual) placeholderVisual.style.display = 'none';
    if (placeholderText) placeholderText.style.display = 'none';
  } catch (error) {
    console.error("Error initializing Leaflet map structure:", error);
    mapContainer.innerHTML = '<p class="error-message" style="margin: auto;">Could not load map.</p>';
  }
}

function addMapOverlay(geojsonData) {
  if (!map) {
    console.error("Map not initialized, cannot add overlay.");
    return;
  }
  lpaLayerMapping = {};
  geojsonLayer = L.geoJSON(geojsonData, {
    style: styleFunction,
    onEachFeature: onEachFeatureFunction
  }).addTo(map);
  console.log("GeoJSON layer added to map.");
  try {
    if (geojsonLayer.getBounds().isValid()) {
      map.fitBounds(geojsonLayer.getBounds().pad(0.1));
    }
  } catch (e) {
    console.warn("Could not fit map bounds to GeoJSON layer:", e);
  }
}

function styleFunction(feature) {
  const statusCode = feature.properties.status_code || 'unknown';
  const color = statusColors[statusCode] || statusColors['default'];
  return { fillColor: color, fillOpacity: 0.6, color: '#555', weight: 1, opacity: 0.8 };
}

function onEachFeatureFunction(feature, layer) {
  if (feature.properties.id) {
    lpaLayerMapping[feature.properties.id] = layer;
  }
  const tooltipContent = `<b>${feature.properties.name || 'Unknown LPA'}</b><br>Status: ${feature.properties.plan_status_display || 'Unknown'}`;
  layer.bindTooltip(tooltipContent);
  layer.on('click', (e) => {
    if (feature.properties.id) {
      console.log(`Map feature clicked: ${feature.properties.name}, ID: ${feature.properties.id}`);
      displayLpaDetails(feature.properties.id);
    } else {
      console.warn("Clicked map feature missing consistent 'id' property.");
    }
  });
  layer.on('mouseover', (e) => {
    e.target.setStyle({ weight: 2, color: '#333', fillOpacity: 0.75 });
  });
  // NEW: Modify mouseout to reapply the correct style in Tilted Balance Mode.
  layer.on('mouseout', (e) => {
    if (tiltedBalanceMode && layer.feature) {
      if (layer.feature.properties.nppf_defaulting === true) {
        layer.setStyle({ fillOpacity: 0.6, opacity: 0.8, color: '#555', weight: 1 });
      } else {
        layer.setStyle({ fillOpacity: 0.2, opacity: 0.4, color: '#aaa', weight: 1 });
      }
      return;
    }
    const currentSelectedId = detailsPanel ? detailsPanel.dataset.lpaId : null;
    if (currentSelectedId !== feature.properties.id) {
      geojsonLayer.resetStyle(e.target);
    }
  });
}

// --- Filter Population ---
function populateFilters() {
  console.log("Populating filters...");
  const regions = new Set(), statuses = new Set(), risks = new Set();
  allLpaData.forEach(lpa => {
    if (lpa.region) regions.add(lpa.region);
    if (lpa.status_code) statuses.add(lpa.status_code);
    if (lpa.plan_risk_score !== null && lpa.plan_risk_score !== undefined) risks.add(lpa.plan_risk_score);
  });
  if (regionFilter) populateSelect(regionFilter, [...regions].sort());
  if (statusFilter) populateSelect(statusFilter, [...statuses].sort(), formatStatusCode);
  if (riskFilter) populateSelect(riskFilter, [...risks].sort((a, b) => a - b));
}

function populateSelect(selectElement, options, formatter = (val) => val) {
  selectElement.innerHTML = '<option value="">All</option>';
  options.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = formatter(optionValue);
    selectElement.appendChild(option);
  });
}

// --- Event Handlers & Display Logic ---
function addEventListeners() {
  console.log("Adding event listeners...");
  let filterTimeout;
  const debounceFilter = () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(applyFiltersAndRedraw, 300);
  };

  if (searchInput) searchInput.addEventListener('input', debounceFilter);
  if (regionFilter) regionFilter.addEventListener('change', debounceFilter);
  if (statusFilter) statusFilter.addEventListener('change', debounceFilter);
  if (riskFilter) riskFilter.addEventListener('change', debounceFilter);
  // NEW: Listen for changes on the Tilted Balance toggle.
  if (tiltedBalanceToggle) tiltedBalanceToggle.addEventListener('change', debounceFilter);

  if (tableHead) tableHead.addEventListener('click', handleSortClick);
  if (tableBody) tableBody.addEventListener('click', handleTableClick);
  if (lpaCardsContainer) lpaCardsContainer.addEventListener('click', handleCardClick);
  if (closeDetailsBtn) closeDetailsBtn.addEventListener('click', hideDetails);
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCSV);
}

function applyFiltersAndRedraw() {
  console.log("Applying filters and redrawing...");
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  const selectedRegion = regionFilter ? regionFilter.value : '';
  const selectedStatus = statusFilter ? statusFilter.value : '';
  const selectedRisk = riskFilter ? riskFilter.value : '';

  filteredLpaData = allLpaData.filter(lpa => {
    const nameMatch = !searchTerm || (lpa.name && lpa.name.toLowerCase().includes(searchTerm));
    const regionMatch = !selectedRegion || lpa.region === selectedRegion;
    const statusMatch = !selectedStatus || lpa.status_code === selectedStatus;
    const riskMatch = !selectedRisk || lpa.plan_risk_score?.toString() === selectedRisk;
    return nameMatch && regionMatch && statusMatch && riskMatch;
  });

  // Update global state for Tilted Balance Mode and filter accordingly
  tiltedBalanceMode = tiltedBalanceToggle && tiltedBalanceToggle.checked;
  if (tiltedBalanceMode) {
    filteredLpaData = filteredLpaData.filter(lpa => lpa.nppf_defaulting === true);
  }

  sortTableData();
  updateDashboard();

  // Update map styling according to Tilted Balance Mode
  if (geojsonLayer) {
    if (tiltedBalanceMode) {
      geojsonLayer.eachLayer(function(layer) {
        if (layer.feature && typeof layer.feature.properties.nppf_defaulting !== 'undefined') {
          if (layer.feature.properties.nppf_defaulting === true) {
            layer.setStyle({ fillOpacity: 0.6, opacity: 0.8, color: '#555', weight: 1 });
          } else {
            layer.setStyle({ fillOpacity: 0.2, opacity: 0.4, color: '#aaa', weight: 1 });
          }
        }
      });
    } else {
      geojsonLayer.eachLayer(function(layer) {
        geojsonLayer.resetStyle(layer);
      });
    }
  }

  if (detailsPanel.style.display !== 'none') {
    const selectedId = detailsPanel.dataset.lpaId;
    if (selectedId && filteredLpaData.some(lpa => lpa.id === selectedId)) {
      highlightSelectedItem(selectedId);
    } else {
      hideDetails();
    }
  }
}

function sortTableData() {
  if (!sortColumn) return;
  filteredLpaData.sort((a, b) => {
    let valA = a[sortColumn], valB = b[sortColumn];
    const aIsNull = valA === null || valA === undefined;
    const bIsNull = valB === null || valB === undefined;
    if (aIsNull && bIsNull) return 0;
    if (aIsNull) return sortDirection === 'asc' ? -1 : 1;
    if (bIsNull) return sortDirection === 'asc' ? 1 : -1;
    let comparison = 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      comparison = valA - valB;
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      comparison = valA.localeCompare(valB);
    }
    return sortDirection === 'asc' ? comparison : comparison * -1;
  });
}

function handleSortClick(event) {
  console.log("Sort click detected");
  const header = event.target.closest('th');
  if (!header || !header.classList.contains('sortable') || !header.dataset.sort) return;
  const newSortColumn = header.dataset.sort;
  if (newSortColumn === sortColumn) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = newSortColumn;
    sortDirection = 'asc';
  }
  sortTableData();
  updateDashboard();
}

function updateSortIndicators() {
  if (!tableHead) return;
  tableHead.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === sortColumn) {
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function updateDashboard() {
  console.log("Updating dashboard view...");
  calculateAndDisplayStats(filteredLpaData);
  const isMobileView = window.matchMedia("(max-width: 768px)").matches;
  if (isMobileView) {
    console.log("Rendering cards view");
    populateCards(filteredLpaData);
    if (tableHead)
      tableHead.querySelectorAll('th.sortable').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
  } else {
    console.log("Rendering table view");
    populateTable(filteredLpaData);
    updateSortIndicators();
  }
  if (detailsPanel.style.display !== 'none') {
    highlightSelectedItem(detailsPanel.dataset.lpaId);
  }
}

function calculateYearsSince(adoptionYear) {
  if (typeof adoptionYear === 'number' && adoptionYear > 1900 && adoptionYear <= currentYear) {
    return currentYear - adoptionYear;
  }
  return null;
}

function formatStatusCode(statusCode) {
  switch (statusCode) {
    case 'adopted_recent': return 'Adopted & Current';
    case 'just_adopted_updating': return 'Just Adopted / Updating';
    case 'adopted_outdated': return 'Adopted >5 yrs';
    case 'emerging_in_progress': return 'Emerging';
    case 'withdrawn_or_vacuum': return 'Withdrawn / Vacuum';
    case 'unknown':
    default:
      return statusCode ? String(statusCode).replace(/_/g, ' ') : 'Unknown';
  }
}

function populateTable(data) {
  if (!tableBody) return;
  tableBody.innerHTML = '';
  if (!data || data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="info-message">No LPAs match the current filters.</td></tr>`;
    return;
  }
  data.forEach(lpa => {
    const row = tableBody.insertRow();
    row.dataset.lpaId = lpa.id;
    if (lpa.status_code)
      row.classList.add(`status-${lpa.status_code}`);
    createCell(row, lpa.name ?? 'N/A');
    createCell(row, lpa.plan_status_display);
    createCell(row, lpa.last_adoption_year ?? 'N/A', true);
    createCell(row, lpa.years_since_adoption ?? 'N/A', true);
    createCell(row, lpa.plan_risk_score ?? 'N/A', true);
  });
}

function populateCards(data) {
  if (!lpaCardsContainer) return;
  lpaCardsContainer.innerHTML = '';
  if (!data || data.length === 0) {
    lpaCardsContainer.innerHTML = `<p class="info-message">No LPAs match the current filters.</p>`;
    return;
  }
  data.forEach(lpa => {
    const card = document.createElement('div');
    card.className = 'lpa-card';
    if (lpa.status_code)
      card.classList.add(`status-${lpa.status_code}`);
    card.dataset.lpaId = lpa.id;
    card.innerHTML = `
      <div class="lpa-card-header">${lpa.name ?? 'N/A'}</div>
      <div class="lpa-card-status">${lpa.plan_status_display ?? 'N/A'}</div>
      <div class="lpa-card-details">
        <span><span class="label">Adopted:</span> ${lpa.last_adoption_year ?? 'N/A'}</span>
        <span><span class="label">Risk:</span> ${lpa.plan_risk_score ?? 'N/A'}</span>
      </div>
    `;
    lpaCardsContainer.appendChild(card);
  });
}

function createCell(row, text, center = false) {
  const cell = row.insertCell();
  cell.textContent = text;
  if (center) cell.classList.add('center');
  return cell;
}

function handleTableClick(event) {
  const row = event.target.closest('tr');
  if (!row || !row.dataset.lpaId || !detailsPanel) return;
  const lpaId = row.dataset.lpaId;
  console.log(`Table row clicked for lpaId: ${lpaId}`);
  displayLpaDetails(lpaId);
}

function handleCardClick(event) {
  const card = event.target.closest('.lpa-card');
  if (!card || !card.dataset.lpaId || !detailsPanel) return;
  const lpaId = card.dataset.lpaId;
  console.log(`Card clicked for lpaId: ${lpaId}`);
  displayLpaDetails(lpaId);
}

/** Displays details of an LPA */
function displayLpaDetails(lpaId) {
  console.log(`Attempting to display details for lpaId: ${lpaId}`);
  const lpa = allLpaData.find(item => item.id === lpaId);
  const detailElements = [
    detailsPanel, detailsLpaName, detailsPlanStatus,
    detailsRiskScore, detailsYearsSince, detailsUpdateProgress,
    detailsNppfDefault, detailsNotes, detailsReferences
  ];
  if (!lpa || detailElements.some(el => !el)) {
    console.warn("Cannot display details; missing LPA entry or detail element.");
    return;
  }
  console.log("Found LPA data:", lpa);
  detailsLpaName.textContent = lpa.name ?? 'N/A';
  detailsPlanStatus.textContent = lpa.plan_status ?? 'N/A';
  detailsYearsSince.textContent = lpa.years_since_adoption ?? 'N/A';
  detailsNotes.textContent = lpa.notes ?? 'No specific notes available.';
  const riskScore = lpa.plan_risk_score;
  let riskHtml = 'N/A';
  if (riskScore !== null && riskScore !== undefined) {
    let riskClass = 'risk-unknown';
    if (riskScore <= 3) {
      riskClass = 'risk-low';
    } else if (riskScore <= 7) {
      riskClass = 'risk-medium';
    } else {
      riskClass = 'risk-high';
    }
    riskHtml = `<span class="risk-emoji ${riskClass}"></span>${riskScore}`;
  }
  detailsRiskScore.innerHTML = riskHtml;
  const updateInProgress = lpa.update_in_progress;
  detailsUpdateProgress.innerHTML = (updateInProgress === true) ? '✅ Yes' : (updateInProgress === false ? '❌ No' : 'N/A');
  const nppfDefaulting = lpa.nppf_defaulting;
  detailsNppfDefault.innerHTML = (nppfDefaulting === true) ? '❌ Yes' : (nppfDefaulting === false ? '✅ No' : 'N/A');
  detailsReferences.innerHTML = '';
  if (lpa.references && Array.isArray(lpa.references) && lpa.references.length > 0) {
    lpa.references.forEach(refString => {
      if (!refString) return;
      const trimmedRef = refString.trim();
      if (trimmedRef.startsWith('http://') || trimmedRef.startsWith('https://')) {
        const link = document.createElement('a');
        link.href = trimmedRef;
        try {
          const url = new URL(trimmedRef);
          link.textContent = url.hostname.replace(/^www\./, '');
        } catch (_) {
          link.textContent = trimmedRef;
        }
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        detailsReferences.appendChild(link);
      } else {
        const text = document.createElement('p');
        text.textContent = trimmedRef;
        detailsReferences.appendChild(text);
      }
    });
  } else {
    detailsReferences.innerHTML = '<p class="no-refs">No references available.</p>';
  }
  detailsPanel.dataset.lpaId = lpaId;
  detailsPanel.style.display = 'block';
  highlightSelectedItem(lpaId);
  detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  console.log("Scrolled details panel into view");
}

function hideDetails() {
  console.log("Hiding details panel");
  if (detailsPanel) {
    detailsPanel.style.display = 'none';
    detailsPanel.removeAttribute('data-lpa-id');
    if (detailsLpaName) detailsLpaName.textContent = '--';
    if (detailsPlanStatus) detailsPlanStatus.textContent = '--';
    if (detailsRiskScore) detailsRiskScore.textContent = '--';
    if (detailsYearsSince) detailsYearsSince.textContent = '--';
    if (detailsUpdateProgress) detailsUpdateProgress.textContent = '--';
    if (detailsNppfDefault) detailsNppfDefault.textContent = '--';
    if (detailsNotes) detailsNotes.textContent = '--';
    if (detailsReferences) detailsReferences.innerHTML = '<p class="no-refs">No references available.</p>';
    removeHighlights();
  }
}

/** Highlights the selected item in the table, card view, and map */
function highlightSelectedItem(lpaId) {
  if (!lpaId) return;
  removeHighlights();
  const row = tableBody ? tableBody.querySelector(`tr[data-lpa-id="${lpaId}"]`) : null;
  const card = lpaCardsContainer ? lpaCardsContainer.querySelector(`.lpa-card[data-lpa-id="${lpaId}"]`) : null;
  if (row) {
    console.log("Highlighting row:", lpaId);
    row.classList.add('selected-row');
  }
  if (card) {
    console.log("Highlighting card:", lpaId);
    card.classList.add('selected-card');
  }
  const layer = lpaLayerMapping[lpaId];
  if (layer) {
    console.log("Highlighting map layer:", lpaId);
    layer.setStyle({
      weight: 3,
      color: '#000',
      opacity: 1
    });
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
  }
}

/** Removes highlights from previously selected items */
function removeHighlights() {
  const selectedRow = tableBody ? tableBody.querySelector('.selected-row') : null;
  const selectedCard = lpaCardsContainer ? lpaCardsContainer.querySelector('.selected-card') : null;
  if (selectedRow) selectedRow.classList.remove('selected-row');
  if (selectedCard) selectedCard.classList.remove('selected-card');
  const previouslySelectedId = detailsPanel ? detailsPanel.dataset.lpaId : null;
  if (previouslySelectedId && lpaLayerMapping[previouslySelectedId]) {
    console.log("Resetting style for previously selected layer:", previouslySelectedId);
    geojsonLayer.resetStyle(lpaLayerMapping[previouslySelectedId]);
  }
}

function calculateAndDisplayStats(data) {
  const total = data.length;
  const statElements = [statAdoptedRecent, statJustAdopted, statAdoptedOutdated, statEmerging, statWithdrawn];
  if (statElements.some(el => !el)) return;
  const zeroOutStats = () => statElements.forEach(el => el.textContent = '0%');
  if (total === 0) {
    zeroOutStats();
    return;
  }
  let counts = {
    adopted_recent: 0,
    just_adopted_updating: 0,
    adopted_outdated: 0,
    emerging_in_progress: 0,
    withdrawn_or_vacuum: 0
  };
  data.forEach(lpa => {
    if (counts.hasOwnProperty(lpa.status_code)) {
      counts[lpa.status_code]++;
    }
  });
  const formatPercent = (count, total) => `${((count / total) * 100).toFixed(0)}%`;
  statAdoptedRecent.textContent = formatPercent(counts.adopted_recent, total);
  statJustAdopted.textContent = formatPercent(counts.just_adopted_updating, total);
  statAdoptedOutdated.textContent = formatPercent(counts.adopted_outdated, total);
  statEmerging.textContent = formatPercent(counts.emerging_in_progress, total);
  statWithdrawn.textContent = formatPercent(counts.withdrawn_or_vacuum, total);
}

function exportToCSV() {
  if (!filteredLpaData || filteredLpaData.length === 0) {
    alert("No data to export.");
    return;
  }
  console.log(`Exporting ${filteredLpaData.length} rows...`);
  const headers = [
    "ID", "LPA Name", "Region", "Plan Status Text", "Status Code",
    "Up-to-date?", "Last Adopted Year", "Years Since Adoption",
    "Update in Progress?", "NPPF Defaulting?", "Plan Risk Score",
    "Notes (Short)", "Notes (Full)", "References"
  ];
  const formatBooleanForCSV = (value) => (value === true ? 'Yes' : (value === false ? 'No' : ''));
  const dataRows = filteredLpaData.map(lpa => {
    const refs = (lpa.references && Array.isArray(lpa.references)) ? lpa.references.join('; ') : '';
    const years = calculateYearsSince(lpa.last_adoption_year);
    return [
      lpa.id, lpa.name, lpa.region, lpa.plan_status, lpa.status_code,
      formatBooleanForCSV(lpa.up_to_date), lpa.last_adoption_year, years ?? '',
      formatBooleanForCSV(lpa.update_in_progress),
      formatBooleanForCSV(lpa.nppf_defaulting), lpa.plan_risk_score,
      lpa.notes_short, lpa.notes, refs
    ].map(v => v ?? '');
  });
  const escapeCsvCell = (cell) => {
    const cellString = String(cell);
    if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n') || cellString.includes('\r')) {
      return `"${cellString.replace(/"/g, '""')}"`;
    }
    return cellString;
  };
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += headers.map(escapeCsvCell).join(",") + "\r\n";
  dataRows.forEach(rowArray => {
    csvContent += rowArray.map(escapeCsvCell).join(",") + "\r\n";
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "local_plan_status_export.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  console.log("CSV export triggered.");
}

// --- End of script ---
