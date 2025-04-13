// --- Configuration & State ---
const dataURL = 'status-data.json'; // Your data file
const currentYear = new Date().getFullYear();
let allLpaData = []; // To store all fetched data
let filteredLpaData = []; // To store currently filtered data
let map = null; // Placeholder for Leaflet map instance

// --- DOM Elements (Declare variables, assign inside DOMContentLoaded) ---
let tableBody, searchInput, regionFilter, statusFilter, riskFilter;
let detailsPanel, detailsLpaName, detailsPlanStatus, detailsStatusCode, detailsYearsSince;
let detailsUpdateProgress, detailsNppfDefault, detailsNotes, detailsReferences, closeDetailsBtn;
// UPDATED: Added new stat elements
let statAdoptedRecent, statJustAdopted, statAdoptedOutdated, statEmerging, statWithdrawn;
let exportCsvBtn, mapContainer;


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    // --- Assign DOM Elements ---
    tableBody = document.getElementById('status-table-body');
    console.log('tableBody:', tableBody);
    searchInput = document.getElementById('search-lpa');
    console.log('searchInput:', searchInput);
    regionFilter = document.getElementById('region-filter');
    console.log('regionFilter:', regionFilter);
    statusFilter = document.getElementById('status-filter');
    console.log('statusFilter:', statusFilter);
    riskFilter = document.getElementById('risk-filter');
    console.log('riskFilter:', riskFilter);
    detailsPanel = document.getElementById('selected-authority-details');
    console.log('detailsPanel:', detailsPanel);
    detailsLpaName = document.getElementById('details-lpa-name');
    console.log('detailsLpaName:', detailsLpaName);
    detailsPlanStatus = document.getElementById('details-plan-status');
    console.log('detailsPlanStatus:', detailsPlanStatus);
    detailsStatusCode = document.getElementById('details-status-code');
    console.log('detailsStatusCode:', detailsStatusCode);
    detailsYearsSince = document.getElementById('details-years-since');
    console.log('detailsYearsSince:', detailsYearsSince);
    detailsUpdateProgress = document.getElementById('details-update-progress');
    console.log('detailsUpdateProgress:', detailsUpdateProgress);
    detailsNppfDefault = document.getElementById('details-nppf-default');
    console.log('detailsNppfDefault:', detailsNppfDefault);
    detailsNotes = document.getElementById('details-notes');
    console.log('detailsNotes:', detailsNotes);
    detailsReferences = document.getElementById('details-references');
    console.log('detailsReferences:', detailsReferences);
    closeDetailsBtn = document.getElementById('close-details-btn');
    console.log('closeDetailsBtn:', closeDetailsBtn);
    // UPDATED: Assign new stat elements
    statAdoptedRecent = document.getElementById('stat-adopted-recent');
    console.log('statAdoptedRecent:', statAdoptedRecent);
    statJustAdopted = document.getElementById('stat-just-adopted');
    console.log('statJustAdopted:', statJustAdopted);
    statAdoptedOutdated = document.getElementById('stat-adopted-outdated');
    console.log('statAdoptedOutdated:', statAdoptedOutdated);
    statEmerging = document.getElementById('stat-emerging');
    console.log('statEmerging:', statEmerging);
    statWithdrawn = document.getElementById('stat-withdrawn');
    console.log('statWithdrawn:', statWithdrawn);

    exportCsvBtn = document.getElementById('export-csv-btn');
    console.log('exportCsvBtn:', exportCsvBtn);
    mapContainer = document.getElementById('map-container');
    console.log('mapContainer:', mapContainer);

    // --- Basic Check ---
    if (!tableBody || !searchInput || !detailsPanel || !exportCsvBtn || !mapContainer || !closeDetailsBtn ||
        !statAdoptedRecent || !statJustAdopted || !statAdoptedOutdated || !statEmerging || !statWithdrawn) { // Check new stats too
        console.error("Dashboard init failed: One or more critical DOM elements were not found. Check logs and HTML IDs.");
        const container = document.querySelector('.container');
        if(container) { /* ... (error message display code remains same) ... */ }
        return;
    }
    console.log("All expected DOM elements successfully selected.");

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
        });

        filteredLpaData = [...allLpaData];
        populateFilters();
        updateDashboard();

    } catch (error) {
        console.error("Error fetching status data:", error);
        if (tableBody) { /* ... (error message handling remains same) ... */ }
        // Update all stat displays on error
        if (statAdoptedRecent) statAdoptedRecent.textContent = 'ERR';
        if (statJustAdopted) statJustAdopted.textContent = 'ERR';
        if (statAdoptedOutdated) statAdoptedOutdated.textContent = 'ERR';
        if (statEmerging) statEmerging.textContent = 'ERR';
        if (statWithdrawn) statWithdrawn.textContent = 'ERR';
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
    console.log("Attempting to add event listeners...");
    let filterTimeout;
    const debounceFilter = () => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(applyFiltersAndRedraw, 300);
    };

    if (searchInput) { searchInput.addEventListener('input', debounceFilter); console.log("Listener added: searchInput"); } else { console.warn("Listener not added: searchInput is null"); }
    if (regionFilter) { regionFilter.addEventListener('change', debounceFilter); console.log("Listener added: regionFilter"); } else { console.warn("Listener not added: regionFilter is null"); }
    if (statusFilter) { statusFilter.addEventListener('change', debounceFilter); console.log("Listener added: statusFilter"); } else { console.warn("Listener not added: statusFilter is null"); }
    if (riskFilter) { riskFilter.addEventListener('change', debounceFilter); console.log("Listener added: riskFilter"); } else { console.warn("Listener not added: riskFilter is null"); }
    if (tableBody) { tableBody.addEventListener('click', handleTableClick); console.log("Listener added: tableBody"); } else { console.warn("Listener not added: tableBody is null"); }
    if (closeDetailsBtn) { closeDetailsBtn.addEventListener('click', hideDetails); console.log("Listener added: closeDetailsBtn"); } else { console.warn("Listener not added: closeDetailsBtn is null"); }
    if (exportCsvBtn) { exportCsvBtn.addEventListener('click', exportToCSV); console.log("Listener added: exportCsvBtn"); } else { console.warn("Listener not added: exportCsvBtn is null"); }
}

/**
 * Applies all active filters to the data and redraws the dashboard.
 */
function applyFiltersAndRedraw() {
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

    if (detailsPanel && detailsPanel.style.display !== 'none') { /* ... (hide details if filtered out remains same) ... */ }
    updateDashboard();
}

/**
 * Updates the table, stats, and potentially the map based on filteredData.
 */
function updateDashboard() {
    populateTable(filteredLpaData);
    calculateAndDisplayStats(filteredLpaData);
    // TODO: Update map
}

/**
 * Calculates years since adoption.
 */
function calculateYearsSince(adoptionYear) {
    if (typeof adoptionYear === 'number' && adoptionYear > 1900 && adoptionYear <= currentYear) {
        return currentYear - adoptionYear;
    }
    return 'N/A';
}

/**
 * Maps status codes to user-friendly display text for filters/details.
 */
function formatStatusCode(statusCode) {
    switch (statusCode) {
        case 'adopted_recent': return 'Adopted & Current'; // Match stats label
        case 'just_adopted_updating': return 'Just Adopted / Updating';
        case 'adopted_outdated': return 'Adopted >5 yrs'; // Match stats label
        case 'emerging_in_progress': return 'Emerging'; // Match stats label
        case 'withdrawn_or_vacuum': return 'Withdrawn / Vacuum'; // Match stats label
        case 'unknown':
        default: return statusCode ? String(statusCode).replace(/_/g, ' ') : 'Unknown';
    }
}

/**
 * Populates the table with LPA data.
 */
function populateTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!Array.isArray(data) || data.length === 0) { /* ... (no results message remains same) ... */ return; }

    data.forEach(lpa => {
        const row = tableBody.insertRow();
        row.dataset.lpaId = lpa.id;
        createCell(row, lpa.name || 'N/A');
        createCell(row, lpa.plan_status_display || 'N/A');
        createCell(row, lpa.last_adoption_year || 'N/A', true);
        createCell(row, lpa.years_since_adoption, true);
        createCell(row, lpa.plan_risk_score ?? 'N/A', true);
        if (lpa.status_code) row.classList.add(`status-${lpa.status_code}`);
    });
}

/** Helper to create and append a table cell. */
function createCell(row, text, center = false) {
    const cell = row.insertCell();
    cell.textContent = text;
    if (center) cell.classList.add('center');
    return cell;
}

/** Formats boolean values for display. */
function formatBoolean(value) {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'N/A';
}

/**
 * Handles clicks within the table body (event delegation).
 */
function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (!row || !row.dataset.lpaId || !detailsPanel) return;
    displayLpaDetails(row.dataset.lpaId);
}

/**
 * Finds LPA data by ID and displays it in the details panel.
 */
function displayLpaDetails(lpaId) {
    const lpa = allLpaData.find(item => item.id === lpaId);
    // Ensure all elements exist
    if (!lpa || !detailsPanel || !detailsLpaName || !detailsPlanStatus || !detailsStatusCode ||
        !detailsYearsSince || !detailsUpdateProgress || !detailsNppfDefault || !detailsNotes || !detailsReferences) {
        console.warn("Cannot display details, LPA data or detail panel elements missing.");
        return;
    }

    // Populate basic fields
    detailsLpaName.textContent = lpa.name || 'N/A';
    detailsPlanStatus.textContent = lpa.plan_status || 'N/A';
    detailsStatusCode.textContent = lpa.status_code || 'N/A';
    detailsYearsSince.textContent = lpa.years_since_adoption;
    detailsUpdateProgress.textContent = formatBoolean(lpa.update_in_progress);
    detailsNppfDefault.textContent = formatBoolean(lpa.nppf_defaulting);
    detailsNotes.textContent = lpa.notes || 'No specific notes available.';

    // UPDATED: Populate References
    detailsReferences.innerHTML = ''; // Clear previous content
    if (lpa.references && Array.isArray(lpa.references) && lpa.references.length > 0) {
        lpa.references.forEach(refString => {
            if (!refString) return; // Skip empty references

            // Basic URL detection
            if (refString.trim().startsWith('http://') || refString.trim().startsWith('https://')) {
                const link = document.createElement('a');
                link.href = refString.trim();
                link.textContent = refString.trim(); // Use URL as text for now
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                detailsReferences.appendChild(link);
            } else {
                // If not a URL, display as plain text paragraph
                const text = document.createElement('p');
                text.textContent = refString;
                detailsReferences.appendChild(text);
            }
        });
    } else {
        // Display default message if no references
        const noRefsText = document.createElement('p');
        noRefsText.textContent = 'No references available.';
        noRefsText.className = 'no-refs'; // Add class for potential styling
        detailsReferences.appendChild(noRefsText);
    }

    // Show the panel
    detailsPanel.dataset.lpaId = lpaId;
    detailsPanel.style.display = 'block';
    // detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // Optional scroll
}

/**
 * Hides the details display section.
 */
function hideDetails() {
    if (detailsPanel) {
        detailsPanel.style.display = 'none';
        detailsPanel.removeAttribute('data-lpa-id');
        // Clear content
        if(detailsLpaName) detailsLpaName.textContent = '--';
        if(detailsPlanStatus) detailsPlanStatus.textContent = '--';
        if(detailsStatusCode) detailsStatusCode.textContent = '--';
        if(detailsYearsSince) detailsYearsSince.textContent = '--';
        if(detailsUpdateProgress) detailsUpdateProgress.textContent = '--';
        if(detailsNppfDefault) detailsNppfDefault.textContent = '--';
        if(detailsNotes) detailsNotes.textContent = '--';
        if(detailsReferences) detailsReferences.innerHTML = '<p class="no-refs">No references available.</p>';
    }
}

/**
 * Calculates and displays the coverage statistics for all 5 statuses.
 */
function calculateAndDisplayStats(data) {
    const total = data.length;
    // Ensure all stat elements exist
    if (!statAdoptedRecent || !statJustAdopted || !statAdoptedOutdated || !statEmerging || !statWithdrawn) {
        console.warn("Cannot calculate stats, one or more stat DOM elements missing.");
        return;
    }

    if (total === 0) {
        statAdoptedRecent.textContent = '0%';
        statJustAdopted.textContent = '0%';
        statAdoptedOutdated.textContent = '0%';
        statEmerging.textContent = '0%';
        statWithdrawn.textContent = '0%';
        return;
    }

    // Initialize counters for all 5 statuses
    let adoptedRecentCount = 0;
    let justAdoptedUpdatingCount = 0;
    let adoptedOutdatedCount = 0;
    let emergingInProgressCount = 0;
    let withdrawnOrVacuumCount = 0;

    data.forEach(lpa => {
        switch (lpa.status_code) {
            case 'adopted_recent':
                adoptedRecentCount++;
                break;
            case 'just_adopted_updating':
                justAdoptedUpdatingCount++;
                break;
            case 'adopted_outdated':
                adoptedOutdatedCount++;
                break;
            case 'emerging_in_progress':
                emergingInProgressCount++;
                break;
            case 'withdrawn_or_vacuum':
                withdrawnOrVacuumCount++;
                break;
            // No default needed, unknown statuses won't be counted in these 5
        }
    });

    const formatPercent = (count, total) => `${((count / total) * 100).toFixed(0)}%`;

    // Update text content for all 5 stat elements
    statAdoptedRecent.textContent = formatPercent(adoptedRecentCount, total);
    statJustAdopted.textContent = formatPercent(justAdoptedUpdatingCount, total);
    statAdoptedOutdated.textContent = formatPercent(adoptedOutdatedCount, total);
    statEmerging.textContent = formatPercent(emergingInProgressCount, total);
    statWithdrawn.textContent = formatPercent(withdrawnOrVacuumCount, total);
}


/**
 * Exports the currently filtered data to a CSV file.
 * Handles array fields (references) and proper CSV escaping.
 */
function exportToCSV() {
    // Ensure there's data to export based on current filters
    if (!filteredLpaData || filteredLpaData.length === 0) {
        alert("No data to export based on current filters.");
        return;
    }

    console.log(`Exporting ${filteredLpaData.length} rows to CSV...`);

    // Define the columns/headers for the CSV file
    // Adjust this array to include/exclude/reorder columns as needed
    const headers = [
        "ID",
        "LPA Name",
        "Region",
        "Plan Status Text",
        "Status Code",
        "Up-to-date?",
        "Last Adopted Year",
        "Years Since Adoption",
        "Update in Progress?",
        "NPPF Defaulting?",
        "Plan Risk Score",
        "Notes (Short)",
        "Notes (Full)",
        "References" // References will be joined into one cell
    ];

    // Helper function to format boolean values for CSV
    const formatBooleanForCSV = (value) => {
        if (value === true) return 'Yes';
        if (value === false) return 'No';
        return ''; // Represent null/undefined/non-boolean as empty string
    };

    // Prepare the data rows for the CSV
    const dataRows = filteredLpaData.map(lpa => {
        // Join the references array into a single string, separated by semicolons
        const referencesString = (lpa.references && Array.isArray(lpa.references))
            ? lpa.references.join('; ')
            : '';

        // Calculate years since adoption again or use pre-calculated value
        const yearsSince = calculateYearsSince(lpa.last_adoption_year); // Ensure it's up-to-date

        return [
            lpa.id || '',
            lpa.name || '',
            lpa.region || '',
            lpa.plan_status || '', // The descriptive text
            lpa.status_code || '', // The internal code
            formatBooleanForCSV(lpa.up_to_date),
            lpa.last_adoption_year || '',
            yearsSince === 'N/A' ? '' : yearsSince, // Handle 'N/A' case
            formatBooleanForCSV(lpa.update_in_progress),
            formatBooleanForCSV(lpa.nppf_defaulting),
            lpa.plan_risk_score ?? '', // Handle null/undefined risk score
            lpa.notes_short || '',
            lpa.notes || '', // Full notes
            referencesString // Joined references
        ];
    });

    // Function to escape cell content for CSV format
    // Handles commas, double quotes, and newlines within cells
    const escapeCsvCell = (cell) => {
        const cellString = String(cell ?? ''); // Convert to string, handle null/undefined
        // If the cell contains a comma, double quote, or newline character:
        if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n') || cellString.includes('\r')) {
            // Enclose the entire cell string in double quotes
            // Escape any existing double quotes within the string by doubling them ("" -> """")
            return `"${cellString.replace(/"/g, '""')}"`;
        }
        // Otherwise, return the string as is
        return cellString;
    };

    // Build the CSV content string
    let csvContent = "data:text/csv;charset=utf-8,";

    // Add the header row
    csvContent += headers.map(escapeCsvCell).join(",") + "\r\n";

    // Add the data rows
    dataRows.forEach(rowArray => {
        let row = rowArray.map(escapeCsvCell).join(",");
        csvContent += row + "\r\n";
    });

    // Create a link element and trigger the download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "local_plan_status_export.csv");
    document.body.appendChild(link); // Append link to body (required for Firefox)
    link.click();                     // Simulate click to trigger download
    document.body.removeChild(link);  // Remove link from body after click

    console.log("CSV export triggered.");
}

// --- End of script ---