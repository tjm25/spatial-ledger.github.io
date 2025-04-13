// --- Configuration & State ---
const dataURL = 'status-data.json'; // Your data file
const currentYear = new Date().getFullYear();
let allLpaData = []; // To store all fetched data
let filteredLpaData = []; // To store currently filtered data
let map = null; // Placeholder for Leaflet map instance
let sortColumn = 'name'; // Default sort column
let sortDirection = 'asc'; // Default sort direction ('asc' or 'desc')

// --- DOM Elements (Declare variables, assign inside DOMContentLoaded) ---
let tableBody, tableHead, searchInput, regionFilter, statusFilter, riskFilter;
let detailsPanel, detailsLpaName, detailsPlanStatus, detailsRiskScore, detailsYearsSince;
let detailsUpdateProgress, detailsNppfDefault, detailsNotes, detailsReferences, closeDetailsBtn;
let statAdoptedRecent, statJustAdopted, statAdoptedOutdated, statEmerging, statWithdrawn;
let exportCsvBtn, mapContainer, lpaCardsContainer;


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    // --- Assign DOM Elements ---
    tableBody = document.getElementById('status-table-body');
    tableHead = document.getElementById('lpa-table-head');
    searchInput = document.getElementById('search-lpa');
    regionFilter = document.getElementById('region-filter');
    statusFilter = document.getElementById('status-filter');
    riskFilter = document.getElementById('risk-filter');
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

    // --- Basic Check ---
    const criticalElements = [tableBody, tableHead, searchInput, detailsPanel, detailsRiskScore, exportCsvBtn, mapContainer, lpaCardsContainer, closeDetailsBtn, statAdoptedRecent, statJustAdopted, statAdoptedOutdated, statEmerging, statWithdrawn];
    if (criticalElements.some(el => !el)) {
        console.error("Dashboard init failed: One or more critical DOM elements were not found. Check HTML IDs.");
        const container = document.querySelector('.container');
        if(container) {
             const errorMsg = document.createElement('p'); errorMsg.className = 'error-message'; errorMsg.style.margin = '20px'; errorMsg.textContent = 'Error initializing dashboard components. Please check the console (F12).';
             const header = document.querySelector('.dashboard-header');
             if(header) header.parentNode.insertBefore(errorMsg, header.nextSibling); else container.prepend(errorMsg);
        }
        return;
    }
    console.log("All critical DOM elements found.");

    // --- Initialize & Fetch ---
    initializeMap();
    fetchData();
    addEventListeners();
});

// --- Functions ---

/**
 * Initializes a basic Leaflet map placeholder.
 */
function initializeMap() {
    try {
        map = L.map(mapContainer).setView([52.5, -1.5], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        console.log("Basic Leaflet map initialized.");
        const placeholderVisual = mapContainer.querySelector('.map-placeholder-visual');
        const placeholderText = mapContainer.querySelector('.map-placeholder-text');
        if (placeholderVisual) placeholderVisual.style.display = 'none';
        if (placeholderText) placeholderText.style.display = 'none';
    } catch (error) {
        console.error("Error initializing Leaflet map:", error);
        mapContainer.innerHTML = '<p class="error-message" style="margin: auto;">Could not load map.</p>';
    }
}

/**
 * Fetches LPA status data from the JSON file.
 */
async function fetchData() {
    try {
        const response = await fetch(dataURL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allLpaData = await response.json();
        console.log(`Fetched ${allLpaData.length} LPA records.`);

        // Pre-process data
        allLpaData.forEach((lpa, index) => {
            lpa.id = lpa.id || `lpa-${index}`;
            lpa.years_since_adoption = calculateYearsSince(lpa.last_adoption_year);
            lpa.plan_status_display = formatStatusCode(lpa.status_code);
            lpa.last_adoption_year = lpa.last_adoption_year ? parseInt(lpa.last_adoption_year, 10) : null;
            if (isNaN(lpa.last_adoption_year)) lpa.last_adoption_year = null;
            lpa.plan_risk_score = lpa.plan_risk_score !== null && lpa.plan_risk_score !== undefined ? parseInt(lpa.plan_risk_score, 10) : null;
             if (isNaN(lpa.plan_risk_score)) lpa.plan_risk_score = null;
            lpa.years_since_adoption = typeof lpa.years_since_adoption === 'number' ? lpa.years_since_adoption : null;
        });

        filteredLpaData = [...allLpaData];
        populateFilters();
        sortTableData();
        updateDashboard();

    } catch (error) {
        console.error("Error fetching status data:", error);
        if (tableBody) { /* ... */ }
        if (lpaCardsContainer) { lpaCardsContainer.innerHTML = '<p class="error-message">Error loading data.</p>';}
        if (statAdoptedRecent) statAdoptedRecent.textContent = 'ERR'; /* etc */
    }
}

/**
 * Populates filter dropdowns based on available data.
 */
function populateFilters() {
    const regions = new Set();
    const statuses = new Set();
    const risks = new Set();
    allLpaData.forEach(lpa => {
        if (lpa.region) regions.add(lpa.region);
        if (lpa.status_code) statuses.add(lpa.status_code);
        if (lpa.plan_risk_score !== null && lpa.plan_risk_score !== undefined) risks.add(lpa.plan_risk_score);
    });
    if (regionFilter) populateSelect(regionFilter, [...regions].sort());
    if (statusFilter) populateSelect(statusFilter, [...statuses].sort(), formatStatusCode);
    if (riskFilter) populateSelect(riskFilter, [...risks].sort((a, b) => a - b));
}

/** Helper to populate a select dropdown */
function populateSelect(selectElement, options, formatter = (val) => val) {
    selectElement.innerHTML = '<option value="">All</option>';
    options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = formatter(optionValue);
        selectElement.appendChild(option);
    });
}

/**
 * Adds event listeners for filters, table clicks, etc.
 */
function addEventListeners() {
    console.log("Adding event listeners...");
    let filterTimeout;
    const debounceFilter = () => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(applyFiltersAndRedraw, 300);
    };

    // Filters
    if (searchInput) searchInput.addEventListener('input', debounceFilter);
    if (regionFilter) regionFilter.addEventListener('change', debounceFilter);
    if (statusFilter) statusFilter.addEventListener('change', debounceFilter);
    if (riskFilter) riskFilter.addEventListener('change', debounceFilter);

    // Table Header for Sorting
    if (tableHead) tableHead.addEventListener('click', handleSortClick);

    // Table Body for Row Click
    if (tableBody) tableBody.addEventListener('click', handleTableClick);

    // Card Container for Card Click
    if (lpaCardsContainer) lpaCardsContainer.addEventListener('click', handleCardClick);

    // Details Panel Close Button
    if (closeDetailsBtn) closeDetailsBtn.addEventListener('click', hideDetails);

    // Export Button
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCSV);

    // Optional: Resize listener
    // window.addEventListener('resize', debounce(() => updateDashboard(), 250));
}

/**
 * Applies all active filters to the data and redraws the dashboard.
 */
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

    sortTableData();
    updateDashboard();

    // Re-apply selection highlight or hide details
    if (detailsPanel.style.display !== 'none') {
        const selectedId = detailsPanel.dataset.lpaId;
        if (selectedId && filteredLpaData.some(lpa => lpa.id === selectedId)) {
            highlightSelectedItem(selectedId);
        } else {
            hideDetails();
        }
    }
}

/** Sorts filteredLpaData based on sortColumn and sortDirection */
function sortTableData() {
    if (!sortColumn) return;
    filteredLpaData.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        const aIsNull = valA === null || valA === undefined;
        const bIsNull = valB === null || valB === undefined;
        if (aIsNull && bIsNull) return 0;
        if (aIsNull) return sortDirection === 'asc' ? -1 : 1;
        if (bIsNull) return sortDirection === 'asc' ? 1 : -1;
        let comparison = 0;
        if (typeof valA === 'number' && typeof valB === 'number') { comparison = valA - valB; }
        else { valA = String(valA).toLowerCase(); valB = String(valB).toLowerCase(); comparison = valA.localeCompare(valB); }
        return sortDirection === 'asc' ? comparison : comparison * -1;
    });
}

/** Handles clicking on table headers for sorting */
function handleSortClick(event) {
    console.log("Sort click detected");
    const header = event.target.closest('th');
    if (!header || !header.classList.contains('sortable') || !header.dataset.sort) return;
    const newSortColumn = header.dataset.sort;
    if (newSortColumn === sortColumn) { sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'; }
    else { sortColumn = newSortColumn; sortDirection = 'asc'; }
    sortTableData();
    updateDashboard();
}

/** Updates visual indicators on table headers */
function updateSortIndicators() {
    if (!tableHead) return;
    tableHead.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === sortColumn) {
            th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
}

/** Checks screen width and calls appropriate render function */
function updateDashboard() {
    console.log("Updating dashboard view...");
    calculateAndDisplayStats(filteredLpaData);
    const isMobileView = window.matchMedia("(max-width: 768px)").matches;
    if (isMobileView) {
        console.log("Rendering cards view");
        populateCards(filteredLpaData);
        if(tableHead) tableHead.querySelectorAll('th.sortable').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
    } else {
        console.log("Rendering table view");
        populateTable(filteredLpaData);
        updateSortIndicators();
    }
    if (detailsPanel.style.display !== 'none') {
        highlightSelectedItem(detailsPanel.dataset.lpaId);
    }
}

/** Calculates years since adoption. Returns null if not applicable */
function calculateYearsSince(adoptionYear) {
    if (typeof adoptionYear === 'number' && adoptionYear > 1900 && adoptionYear <= currentYear) {
        return currentYear - adoptionYear;
    }
    return null;
}

/** Maps status codes to user-friendly display text */
function formatStatusCode(statusCode) { /* ... remains same ... */ }

/** Populates the table */
function populateTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!data || data.length === 0) { tableBody.innerHTML = `<tr><td colspan="5" class="info-message">No LPAs match the current filters.</td></tr>`; return; }
    data.forEach(lpa => {
        const row = tableBody.insertRow();
        row.dataset.lpaId = lpa.id;
        if (lpa.status_code) row.classList.add(`status-${lpa.status_code}`);
        createCell(row, lpa.name);
        createCell(row, lpa.plan_status_display);
        createCell(row, lpa.last_adoption_year, true);
        createCell(row, lpa.years_since_adoption, true);
        createCell(row, lpa.plan_risk_score, true);
    });
}

/** Populates the cards container */
function populateCards(data) {
    if (!lpaCardsContainer) return;
    lpaCardsContainer.innerHTML = '';
    if (!data || data.length === 0) { lpaCardsContainer.innerHTML = `<p class="info-message">No LPAs match the current filters.</p>`; return; }
    data.forEach(lpa => {
        const card = document.createElement('div');
        card.className = 'lpa-card';
        if (lpa.status_code) card.classList.add(`status-${lpa.status_code}`);
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

/** Helper to create and append a table cell. Handles null/undefined. */
function createCell(row, text, center = false) {
    const cell = row.insertCell();
    cell.textContent = (text === null || text === undefined) ? 'N/A' : text;
    if (center) cell.classList.add('center');
    return cell;
}

/** Formats boolean values for display in the details panel (excluding emojis). */
function formatBoolean(value) {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'N/A';
}

/** Handles clicks within the table body */
function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (!row || !row.dataset.lpaId || !detailsPanel) return; // Exit if click is not on a row with an ID
    const lpaId = row.dataset.lpaId;
    console.log(`Table row clicked for lpaId: ${lpaId}`); // DEBUG LOG
    displayLpaDetails(lpaId);
}

/** Handles clicks within the card container */
function handleCardClick(event) {
    const card = event.target.closest('.lpa-card');
    if (!card || !card.dataset.lpaId || !detailsPanel) return; // Exit if click is not on a card with an ID
    const lpaId = card.dataset.lpaId;
    console.log(`Card clicked for lpaId: ${lpaId}`); // DEBUG LOG
    displayLpaDetails(lpaId);
}

/** Finds LPA data by ID and displays it in the details panel */
function displayLpaDetails(lpaId) {
    console.log(`Attempting to display details for lpaId: ${lpaId}`); // DEBUG LOG
    const lpa = allLpaData.find(item => item.id === lpaId);
    const detailElements = [detailsPanel, detailsLpaName, detailsPlanStatus, detailsRiskScore, detailsYearsSince, detailsUpdateProgress, detailsNppfDefault, detailsNotes, detailsReferences];

    if (!lpa) {
        console.error(`LPA data not found for id: ${lpaId}`);
        return;
    }
    if (detailElements.some(el => !el)) {
        console.error("Cannot display details, one or more detail panel DOM elements are missing.");
        return;
    }
    console.log("Found LPA data:", lpa); // DEBUG LOG

    // Populate basic fields
    detailsLpaName.textContent = lpa.name ?? 'N/A';
    detailsPlanStatus.textContent = lpa.plan_status ?? 'N/A';
    detailsYearsSince.textContent = lpa.years_since_adoption ?? 'N/A';
    detailsNotes.textContent = lpa.notes ?? 'No specific notes available.';

    // Format Risk Score
    const riskScore = lpa.plan_risk_score;
    let riskHtml = '';
    if (riskScore !== null && riskScore !== undefined) {
        let riskClass = 'risk-unknown';
        if (riskScore <= 1) { riskClass = 'risk-low'; }
        else if (riskScore <= 3) { riskClass = 'risk-medium'; }
        else if (riskScore >= 4) { riskClass = 'risk-high'; }
        riskHtml = `<span class="risk-emoji ${riskClass}"></span>${riskScore}`;
    } else { riskHtml = 'N/A'; }
    detailsRiskScore.innerHTML = riskHtml;

    // Format Boolean with Emojis
    const updateInProgress = lpa.update_in_progress;
    detailsUpdateProgress.innerHTML = (updateInProgress === true) ? '✅ Yes' : (updateInProgress === false ? '❌ No' : 'N/A');

    const nppfDefaulting = lpa.nppf_defaulting;
    detailsNppfDefault.innerHTML = (nppfDefaulting === true) ? '❌ Yes' : (nppfDefaulting === false ? '✅ No' : 'N/A');

    // Populate References
    detailsReferences.innerHTML = '';
    if (lpa.references && Array.isArray(lpa.references) && lpa.references.length > 0) {
        lpa.references.forEach(refString => {
             if (!refString) return;
             const trimmedRef = refString.trim();
             if (trimmedRef.startsWith('http://') || trimmedRef.startsWith('https://')) {
                 const link = document.createElement('a'); link.href = trimmedRef;
                 try { const url = new URL(trimmedRef); link.textContent = url.hostname.replace(/^www\./, ''); }
                 catch (_) { link.textContent = trimmedRef; }
                 link.target = '_blank'; link.rel = 'noopener noreferrer';
                 detailsReferences.appendChild(link);
             } else {
                 const text = document.createElement('p'); text.textContent = trimmedRef;
                 detailsReferences.appendChild(text);
             }
        });
    } else {
        detailsReferences.innerHTML = '<p class="no-refs">No references available.</p>';
    }

    // Show panel and highlight
    detailsPanel.dataset.lpaId = lpaId; // Store ID for re-highlighting
    console.log("Setting detailsPanel display to 'block'"); // DEBUG LOG
    detailsPanel.style.display = 'block';
    highlightSelectedItem(lpaId);
}

/** Hides the details display section and removes highlights */
function hideDetails() {
    console.log("Hiding details panel"); // DEBUG LOG
    if (detailsPanel) {
        detailsPanel.style.display = 'none';
        detailsPanel.removeAttribute('data-lpa-id');
        // Clear content
        if(detailsLpaName) detailsLpaName.textContent = '--';
        if(detailsPlanStatus) detailsPlanStatus.textContent = '--';
        if(detailsRiskScore) detailsRiskScore.textContent = '--';
        if(detailsYearsSince) detailsYearsSince.textContent = '--';
        if(detailsUpdateProgress) detailsUpdateProgress.textContent = '--';
        if(detailsNppfDefault) detailsNppfDefault.textContent = '--';
        if(detailsNotes) detailsNotes.textContent = '--';
        if(detailsReferences) detailsReferences.innerHTML = '<p class="no-refs">No references available.</p>';
        removeHighlights();
    }
}

/** Adds selected class to the current item (row or card) */
function highlightSelectedItem(lpaId) {
    if (!lpaId) return;
    removeHighlights();
    const row = tableBody ? tableBody.querySelector(`tr[data-lpa-id="${lpaId}"]`) : null;
    const card = lpaCardsContainer ? lpaCardsContainer.querySelector(`.lpa-card[data-lpa-id="${lpaId}"]`) : null;
    if (row) { console.log("Highlighting row:", lpaId); row.classList.add('selected-row'); }
    if (card) { console.log("Highlighting card:", lpaId); card.classList.add('selected-card'); }
}

/** Removes selected class from any item (row or card) */
function removeHighlights() {
    const selectedRow = tableBody ? tableBody.querySelector('.selected-row') : null;
    const selectedCard = lpaCardsContainer ? lpaCardsContainer.querySelector('.selected-card') : null;
    if (selectedRow) selectedRow.classList.remove('selected-row');
    if (selectedCard) selectedCard.classList.remove('selected-card');
}

/** Calculates and displays the coverage statistics for all 5 statuses */
function calculateAndDisplayStats(data) {
    const total = data.length;
    const statElements = [statAdoptedRecent, statJustAdopted, statAdoptedOutdated, statEmerging, statWithdrawn];
    if (statElements.some(el => !el)) { return; }
    const zeroOutStats = () => statElements.forEach(el => el.textContent = '0%');
    if (total === 0) { zeroOutStats(); return; }
    let counts = { adopted_recent: 0, just_adopted_updating: 0, adopted_outdated: 0, emerging_in_progress: 0, withdrawn_or_vacuum: 0 };
    data.forEach(lpa => { if (counts.hasOwnProperty(lpa.status_code)) { counts[lpa.status_code]++; } });
    const formatPercent = (count, total) => `${((count / total) * 100).toFixed(0)}%`;
    statAdoptedRecent.textContent = formatPercent(counts.adopted_recent, total);
    statJustAdopted.textContent = formatPercent(counts.just_adopted_updating, total);
    statAdoptedOutdated.textContent = formatPercent(counts.adopted_outdated, total);
    statEmerging.textContent = formatPercent(counts.emerging_in_progress, total);
    statWithdrawn.textContent = formatPercent(counts.withdrawn_or_vacuum, total);
}

/** Exports the currently filtered data to a CSV file */
function exportToCSV() {
    if (!filteredLpaData || filteredLpaData.length === 0) { alert("No data to export."); return; }
    console.log(`Exporting ${filteredLpaData.length} rows...`);
    const headers = [ "ID", "LPA Name", "Region", "Plan Status Text", "Status Code", "Up-to-date?", "Last Adopted Year", "Years Since Adoption", "Update in Progress?", "NPPF Defaulting?", "Plan Risk Score", "Notes (Short)", "Notes (Full)", "References" ];
    const formatBooleanForCSV = (value) => (value === true ? 'Yes' : (value === false ? 'No' : ''));
    const dataRows = filteredLpaData.map(lpa => {
        const refs = (lpa.references && Array.isArray(lpa.references)) ? lpa.references.join('; ') : '';
        const years = calculateYearsSince(lpa.last_adoption_year);
        return [ lpa.id, lpa.name, lpa.region, lpa.plan_status, lpa.status_code, formatBooleanForCSV(lpa.up_to_date), lpa.last_adoption_year, years ?? '', formatBooleanForCSV(lpa.update_in_progress), formatBooleanForCSV(lpa.nppf_defaulting), lpa.plan_risk_score, lpa.notes_short, lpa.notes, refs ].map(v => v ?? ''); // Ensure all values are strings or empty strings
    });
    const escapeCsvCell = (cell) => {
        const cellString = String(cell); // No need for nullish check here due to map above
        if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n') || cellString.includes('\r')) {
            return `"${cellString.replace(/"/g, '""')}"`;
        }
        return cellString;
    };
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.map(escapeCsvCell).join(",") + "\r\n";
    dataRows.forEach(rowArray => { csvContent += rowArray.map(escapeCsvCell).join(",") + "\r\n"; });
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