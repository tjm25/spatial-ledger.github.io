// --- Configuration & State ---
const dataURL = 'status-data.json'; // Your data file
const currentYear = new Date().getFullYear();
let allLpaData = []; // To store all fetched data
let filteredLpaData = []; // To store currently filtered data
let map = null; // Placeholder for Leaflet map instance

// --- DOM Elements ---
const tableBody = document.getElementById('status-table-body');
const searchInput = document.getElementById('search-lpa');
const regionFilter = document.getElementById('region-filter');
const statusFilter = document.getElementById('status-filter');
const riskFilter = document.getElementById('risk-filter');

const detailsPanel = document.getElementById('selected-authority-details');
const detailsLpaName = document.getElementById('details-lpa-name');
const detailsPlanStatus = document.getElementById('details-plan-status');
const detailsStatusCode = document.getElementById('details-status-code');
const detailsYearsSince = document.getElementById('details-years-since');
const detailsUpdateProgress = document.getElementById('details-update-progress');
const detailsNppfDefault = document.getElementById('details-nppf-default');
const detailsNotes = document.getElementById('details-notes');
const detailsReferences = document.getElementById('details-references');
const closeDetailsBtn = document.getElementById('close-details-btn');

const statAdoptedCurrent = document.getElementById('stat-adopted-current');
const statAdoptedOutdated = document.getElementById('stat-adopted-outdated');
const statNoPlan = document.getElementById('stat-no-plan');

const exportCsvBtn = document.getElementById('export-csv-btn');
const mapContainer = document.getElementById('map-container');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeMap(); // Initialize the map placeholder
    fetchData();     // Fetch data and populate
    addEventListeners(); // Set up interactions
});

// --- Functions ---

/**
 * Initializes a basic Leaflet map placeholder.
 * Replace with actual map implementation later.
 */
function initializeMap() {
    if (!mapContainer) return;
    try {
        // Basic map centered on England
         map = L.map(mapContainer).setView([52.5, -1.5], 6);
         L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
             attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
         }).addTo(map);
         console.log("Basic Leaflet map initialized.");
         // TODO: Load GeoJSON data for LPAs
         // TODO: Add styling based on lpa.status_code
         // TODO: Add hover tooltips
         // TODO: Add click listeners on features to call displayLpaDetails(lpaId)
    } catch (error) {
        console.error("Error initializing Leaflet map:", error);
        mapContainer.innerHTML = '<p class="error-message">Could not load map.</p>';
    }
}


/**
 * Fetches LPA status data from the JSON file.
 */
async function fetchData() {
    try {
        const response = await fetch(dataURL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allLpaData = await response.json();
        console.log(`Fetched ${allLpaData.length} LPA records.`);

        // Pre-process data (calculate dynamic fields, ensure IDs)
        allLpaData.forEach((lpa, index) => {
            lpa.id = lpa.id || `lpa-${index}`; // Ensure unique ID
            lpa.years_since_adoption = calculateYearsSince(lpa.last_adoption_year);
            lpa.plan_status_display = formatStatusCode(lpa.status_code); // Add display text
        });

        filteredLpaData = [...allLpaData]; // Initially, show all data

        populateFilters();
        updateDashboard(); // Initial population

    } catch (error) {
        console.error("Error fetching status data:", error);
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="error-message">Error loading data. Please try again later.</td></tr>`;
        }
        // Display error in stats panel too
        statAdoptedCurrent.textContent = 'ERR';
        statAdoptedOutdated.textContent = 'ERR';
        statNoPlan.textContent = 'ERR';
    }
}

/**
 * Populates filter dropdowns based on available data (example).
 */
function populateFilters() {
    const regions = new Set();
    const statuses = new Set();
    const risks = new Set();

    allLpaData.forEach(lpa => {
        if (lpa.region) regions.add(lpa.region); // Assuming 'region' field exists
        if (lpa.status_code) statuses.add(lpa.status_code);
        if (lpa.plan_risk_score !== null && lpa.plan_risk_score !== undefined) risks.add(lpa.plan_risk_score);
    });

    populateSelect(regionFilter, [...regions].sort());
    populateSelect(statusFilter, [...statuses].sort(), formatStatusCode); // Use formatter for display text
    populateSelect(riskFilter, [...risks].sort((a, b) => a - b));
}

/** Helper to populate a select dropdown */
function populateSelect(selectElement, options, formatter = (val) => val) {
    if (!selectElement) return;
    // Keep the first 'All' option
    selectElement.innerHTML = '<option value="">All</option>';
    options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = formatter(optionValue); // Format display text if needed
        selectElement.appendChild(option);
    });
}


/**
 * Adds event listeners for filters, table clicks, etc.
 */
function addEventListeners() {
    let filterTimeout;
    const debounceFilter = () => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(applyFiltersAndRedraw, 300); // Debounce filters
    };

    if (searchInput) searchInput.addEventListener('input', debounceFilter);
    if (regionFilter) regionFilter.addEventListener('change', debounceFilter);
    if (statusFilter) statusFilter.addEventListener('change', debounceFilter);
    if (riskFilter) riskFilter.addEventListener('change', debounceFilter);

    if (tableBody) {
        tableBody.addEventListener('click', handleTableClick);
    }

    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', hideDetails);
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }
}

/**
 * Applies all active filters to the data and redraws the dashboard.
 */
function applyFiltersAndRedraw() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedRegion = regionFilter.value;
    const selectedStatus = statusFilter.value;
    const selectedRisk = riskFilter.value;

    filteredLpaData = allLpaData.filter(lpa => {
        const nameMatch = !searchTerm || (lpa.name && lpa.name.toLowerCase().includes(searchTerm));
        const regionMatch = !selectedRegion || lpa.region === selectedRegion;
        const statusMatch = !selectedStatus || lpa.status_code === selectedStatus;
        const riskMatch = !selectedRisk || lpa.plan_risk_score?.toString() === selectedRisk; // Handle potential null/undefined

        return nameMatch && regionMatch && statusMatch && riskMatch;
    });

    // Hide details panel if the selected LPA is filtered out
     if (detailsPanel.style.display !== 'none') {
         const displayedLpaId = detailsPanel.dataset.lpaId;
         if (displayedLpaId && !filteredLpaData.some(lpa => lpa.id === displayedLpaId)) {
             hideDetails();
         }
     }


    updateDashboard();
}

/**
 * Updates the table, stats, and potentially the map based on filteredData.
 */
function updateDashboard() {
    populateTable(filteredLpaData);
    calculateAndDisplayStats(filteredLpaData);
    // TODO: Update map based on filteredLpaData (e.g., highlight filtered features)
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
 * Maps status codes to user-friendly display text.
 * Keep this consistent with legend and stats labels.
 */
function formatStatusCode(statusCode) {
    // Use more descriptive names matching the wireframe/legend
    switch (statusCode) {
        case 'adopted_recent':
            return 'Adopted and current';
        case 'just_adopted_updating':
            return 'Just adopted / Updating'; // Added this case
        case 'adopted_outdated':
            return 'Adopted, but >5 yrs';
        case 'emerging_in_progress':
            return 'Emerging in preparation';
        case 'withdrawn_or_vacuum':
            return 'No current plan / Withdrawn';
        case 'unknown':
        default:
            return statusCode ? String(statusCode) : 'Unknown'; // Handle null/undefined
    }
}

/**
 * Populates the table with LPA data.
 */
function populateTable(data) {
    if (!tableBody) return;
    tableBody.innerHTML = ''; // Clear previous data

    if (!Array.isArray(data) || data.length === 0) {
        const cols = tableBody.closest('table')?.querySelector('thead tr')?.cells.length || 5;
        tableBody.innerHTML = `<tr><td colspan="${cols}" class="info-message">No LPAs match the current filters.</td></tr>`;
        return;
    }

    data.forEach(lpa => {
        const row = tableBody.insertRow();
        row.dataset.lpaId = lpa.id; // Use the pre-processed ID

        // Match columns defined in HTML thead
        createCell(row, lpa.name || 'N/A');
        createCell(row, lpa.plan_status_display || 'N/A'); // Use formatted status
        createCell(row, lpa.last_adoption_year || 'N/A', true);
        createCell(row, lpa.years_since_adoption, true); // Use calculated value
        createCell(row, lpa.plan_risk_score ?? 'N/A', true); // Use nullish coalescing

        // Add a class based on status for potential row styling (optional)
        if (lpa.status_code) {
            row.classList.add(`status-${lpa.status_code}`);
        }
    });
}

/** Helper to create and append a table cell. */
function createCell(row, text, center = false) {
    const cell = row.insertCell();
    cell.textContent = text;
    if (center) {
        cell.classList.add('center');
    }
    return cell;
}

/** Formats boolean values for display. */
function formatBoolean(value) {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'N/A'; // Or 'Unknown'
}

/**
 * Handles clicks within the table body (event delegation).
 */
function handleTableClick(event) {
    const row = event.target.closest('tr');
    if (!row || !row.dataset.lpaId) return; // Clicked outside a row or row has no ID

    const lpaId = row.dataset.lpaId;
    displayLpaDetails(lpaId);
}

/**
 * Finds LPA data by ID and displays it in the details panel.
 */
function displayLpaDetails(lpaId) {
    const lpa = allLpaData.find(item => item.id === lpaId); // Find in *all* data
    if (!lpa || !detailsPanel) return;

    // Populate the fields
    detailsLpaName.textContent = lpa.name || 'N/A';
    detailsPlanStatus.textContent = lpa.plan_status || 'N/A'; // Full plan status text
    detailsStatusCode.textContent = lpa.status_code || 'N/A';
    detailsYearsSince.textContent = lpa.years_since_adoption;
    detailsUpdateProgress.textContent = formatBoolean(lpa.update_in_progress);
    detailsNppfDefault.textContent = formatBoolean(lpa.nppf_defaulting);
    detailsNotes.textContent = lpa.notes || 'No specific notes available.'; // Use 'notes' field if available

    // Populate References (Example - adapt based on your data structure)
    detailsReferences.innerHTML = ''; // Clear previous
    let refsHtml = '';
    if (lpa.council_plan_url) {
        refsHtml += `<a href="${lpa.council_plan_url}" target="_blank" rel="noopener noreferrer">Council Local Plan page</a>`;
    }
    if (lpa.inspector_letter_url) {
         refsHtml += `<a href="${lpa.inspector_letter_url}" target="_blank" rel="noopener noreferrer">Inspector's letter</a>`;
    }
    // Add other links if present in data...

    if (!refsHtml) {
        refsHtml = '<p>No references available.</p>';
    }
    detailsReferences.innerHTML = refsHtml;


    // Show the panel and store the ID
    detailsPanel.dataset.lpaId = lpaId; // Store which LPA is displayed
    detailsPanel.style.display = 'block';
    detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // TODO: Highlight the selected row in the table
    // TODO: Pan/zoom the map to the selected LPA's feature if map is integrated
}


/**
 * Hides the details display section.
 */
function hideDetails() {
    if (detailsPanel) {
        detailsPanel.style.display = 'none';
        detailsPanel.removeAttribute('data-lpa-id'); // Clear stored ID
        // Clear content to avoid showing stale data briefly
        detailsLpaName.textContent = '--';
        detailsPlanStatus.textContent = '--';
        // ... clear other fields ...
        detailsNotes.textContent = '--';
        detailsReferences.innerHTML = '<p>No references available.</p>';

        // TODO: Remove highlight from table row
        // TODO: Reset map view if needed
    }
}

/**
 * Calculates and displays the coverage statistics.
 */
function calculateAndDisplayStats(data) {
    const total = data.length;
    if (total === 0) {
        statAdoptedCurrent.textContent = '0%';
        statAdoptedOutdated.textContent = '0%';
        statNoPlan.textContent = '0%';
        return;
    }

    let adoptedCurrentCount = 0;
    let adoptedOutdatedCount = 0;
    let noPlanCount = 0; // Includes withdrawn, vacuum, potentially emerging? Define scope clearly.

    data.forEach(lpa => {
        // Adjust these conditions based on your precise definitions
        if (lpa.status_code === 'adopted_recent' || lpa.status_code === 'just_adopted_updating') {
            adoptedCurrentCount++;
        } else if (lpa.status_code === 'adopted_outdated') {
            adoptedOutdatedCount++;
        } else if (lpa.status_code === 'withdrawn_or_vacuum' || lpa.status_code === 'unknown' || !lpa.status_code) {
             // Consider if 'emerging_in_progress' counts as 'no current plan' for this stat
             noPlanCount++;
        }
    });

    const formatPercent = (count, total) => `${((count / total) * 100).toFixed(0)}%`;

    statAdoptedCurrent.textContent = formatPercent(adoptedCurrentCount, total);
    statAdoptedOutdated.textContent = formatPercent(adoptedOutdatedCount, total);
    statNoPlan.textContent = formatPercent(noPlanCount, total);
}

/**
 * Exports the currently filtered data to a CSV file.
 * Basic implementation. Consider using a library for complex CSV needs.
 */
function exportToCSV() {
    if (filteredLpaData.length === 0) {
        alert("No data to export based on current filters.");
        return;
    }

    // Define columns to include (adjust as needed)
    const headers = [
        "LPA Name", "Region", "Plan Status", "Status Code", "Last Adopted",
        "Years Since Adoption", "Update in Progress", "NPPF Defaulting", "Risk Score", "Notes"
    ];
    const dataRows = filteredLpaData.map(lpa => [
        lpa.name || '',
        lpa.region || '', // Add region if available
        lpa.plan_status || '',
        lpa.status_code || '',
        lpa.last_adoption_year || '',
        lpa.years_since_adoption === 'N/A' ? '' : lpa.years_since_adoption,
        formatBoolean(lpa.update_in_progress),
        formatBoolean(lpa.nppf_defaulting),
        lpa.plan_risk_score ?? '',
        lpa.notes || '' // Include notes if available
    ]);

    // Escape commas and quotes within fields
    const escapeCsvCell = (cell) => {
        const cellString = String(cell ?? ''); // Handle null/undefined -> empty string
        // If cell contains comma, newline, or double quote, enclose in double quotes
        if (cellString.includes(',') || cellString.includes('\n') || cellString.includes('"')) {
            // Escape existing double quotes by doubling them
            return `"${cellString.replace(/"/g, '""')}"`;
        }
        return cellString;
    };

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.map(escapeCsvCell).join(",") + "\r\n"; // Header row

    dataRows.forEach(rowArray => {
        let row = rowArray.map(escapeCsvCell).join(",");
        csvContent += row + "\r\n";
    });

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "local_plan_status_export.csv");
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link);

    console.log("CSV export triggered.");
}