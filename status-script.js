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
let statAdoptedCurrent, statAdoptedOutdated, statNoPlan;
let exportCsvBtn, mapContainer;


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed."); // Log that DOMContentLoaded fired

    // --- Assign DOM Elements NOW that the DOM is ready ---
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

    statAdoptedCurrent = document.getElementById('stat-adopted-current');
    console.log('statAdoptedCurrent:', statAdoptedCurrent);

    statAdoptedOutdated = document.getElementById('stat-adopted-outdated');
    console.log('statAdoptedOutdated:', statAdoptedOutdated);

    statNoPlan = document.getElementById('stat-no-plan');
    console.log('statNoPlan:', statNoPlan);

    exportCsvBtn = document.getElementById('export-csv-btn');
    console.log('exportCsvBtn:', exportCsvBtn);

    mapContainer = document.getElementById('map-container');
    console.log('mapContainer:', mapContainer);


    // --- Basic Check: Ensure critical elements were found ---
    // You could add more checks here if needed, checking for null explicitly
    if (!tableBody || !searchInput || !detailsPanel || !exportCsvBtn || !mapContainer || !closeDetailsBtn /* Add others if critical */) {
        console.error("Dashboard init failed: One or more critical DOM elements were not found. Check the logs above for 'null' values and verify HTML IDs.");
        // Optionally display a user-facing error message on the page
        const container = document.querySelector('.container');
        if(container) {
             const errorMsg = document.createElement('p');
             errorMsg.className = 'error-message';
             errorMsg.style.margin = '20px'; // Add some margin for visibility
             errorMsg.textContent = 'Error initializing dashboard components. Please check the console for details (F12).';
             // Insert after the header or filters
             const header = document.querySelector('.dashboard-header');
             if(header) {
                 header.parentNode.insertBefore(errorMsg, header.nextSibling);
             } else {
                 container.prepend(errorMsg);
             }
        }
        return; // Stop initialization if critical elements are missing
    }
    console.log("All expected DOM elements successfully selected (or passed initial check).");

    // --- Now safe to initialize map, fetch data, and add listeners ---
    initializeMap();
    fetchData();     // This will eventually call populateFilters and updateDashboard
    addEventListeners(); // Add listeners now that elements are selected
});

// --- Functions --- (Keep the rest of the functions as they were)

/**
 * Initializes a basic Leaflet map placeholder.
 */
function initializeMap() {
    // mapContainer is now guaranteed to be assigned (or initialization stopped)
    try {
        map = L.map(mapContainer).setView([52.5, -1.5], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        console.log("Basic Leaflet map initialized.");
        // Clear the placeholder visual/text if map initializes successfully
        const placeholderVisual = mapContainer.querySelector('.map-placeholder-visual');
        const placeholderText = mapContainer.querySelector('.map-placeholder-text');
        if (placeholderVisual) placeholderVisual.style.display = 'none';
        if (placeholderText) placeholderText.style.display = 'none';

        // TODO: Load GeoJSON data for LPAs, style, add interactions
    } catch (error) {
        console.error("Error initializing Leaflet map:", error);
        // Keep the placeholder visible or show specific map error
        mapContainer.innerHTML = '<p class="error-message" style="margin: auto;">Could not load map.</p>';
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

        // Pre-process data
        allLpaData.forEach((lpa, index) => {
            lpa.id = lpa.id || `lpa-${index}`; // Ensure unique ID
            lpa.years_since_adoption = calculateYearsSince(lpa.last_adoption_year);
            lpa.plan_status_display = formatStatusCode(lpa.status_code); // Add display text
        });

        filteredLpaData = [...allLpaData]; // Initially, show all data

        populateFilters(); // Populate dropdowns only after data is fetched
        updateDashboard(); // Initial population of table and stats

    } catch (error) {
        console.error("Error fetching status data:", error);
        // Ensure elements exist before trying to update them
        if (tableBody) {
            const cols = tableBody.closest('table')?.querySelector('thead tr')?.cells.length || 5;
            tableBody.innerHTML = `<tr><td colspan="${cols}" class="error-message">Error loading data. Please try again later.</td></tr>`;
        }
        if (statAdoptedCurrent) statAdoptedCurrent.textContent = 'ERR';
        if (statAdoptedOutdated) statAdoptedOutdated.textContent = 'ERR';
        if (statNoPlan) statNoPlan.textContent = 'ERR';
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
        if (lpa.region) regions.add(lpa.region); // Assuming 'region' field exists
        if (lpa.status_code) statuses.add(lpa.status_code);
        if (lpa.plan_risk_score !== null && lpa.plan_risk_score !== undefined) risks.add(lpa.plan_risk_score);
    });

    // Check if filter elements exist before populating
    if (regionFilter) populateSelect(regionFilter, [...regions].sort());
    if (statusFilter) populateSelect(statusFilter, [...statuses].sort(), formatStatusCode); // Use formatter for display text
    if (riskFilter) populateSelect(riskFilter, [...risks].sort((a, b) => a - b));
}

/** Helper to populate a select dropdown */
function populateSelect(selectElement, options, formatter = (val) => val) {
    // No need for null check here as it's done in populateFilters
    selectElement.innerHTML = '<option value="">All</option>'; // Keep the 'All' option
    options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = formatter(optionValue); // Format display text if needed
        selectElement.appendChild(option);
    });
}


/**
 * Adds event listeners for filters, table clicks, etc.
 * Called AFTER DOM elements are assigned in DOMContentLoaded
 */
function addEventListeners() {
    console.log("Attempting to add event listeners..."); // Log entry into function
    let filterTimeout;
    const debounceFilter = () => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(applyFiltersAndRedraw, 300); // Debounce filters
    };

    // Add checks before adding listeners, although they should exist if init didn't fail
    if (searchInput) {
        searchInput.addEventListener('input', debounceFilter);
        console.log("Added 'input' listener to searchInput");
    } else {
        console.warn("Could not add listener: searchInput is null");
    }

    if (regionFilter) {
        regionFilter.addEventListener('change', debounceFilter);
        console.log("Added 'change' listener to regionFilter");
    } else {
        console.warn("Could not add listener: regionFilter is null");
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', debounceFilter);
        console.log("Added 'change' listener to statusFilter");
    } else {
        console.warn("Could not add listener: statusFilter is null");
    }

    if (riskFilter) {
        riskFilter.addEventListener('change', debounceFilter);
        console.log("Added 'change' listener to riskFilter");
    } else {
        console.warn("Could not add listener: riskFilter is null");
    }

    if (tableBody) {
        tableBody.addEventListener('click', handleTableClick);
        console.log("Added 'click' listener to tableBody");
    } else {
        console.warn("Could not add listener: tableBody is null");
    }

    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', hideDetails);
        console.log("Added 'click' listener to closeDetailsBtn");
    } else {
        console.warn("Could not add listener: closeDetailsBtn is null");
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
        console.log("Added 'click' listener to exportCsvBtn"); // This line should now work
    } else {
        console.warn("Could not add listener: exportCsvBtn is null"); // This would explain the error
    }
}

/**
 * Applies all active filters to the data and redraws the dashboard.
 */
function applyFiltersAndRedraw() {
    // Ensure filter inputs exist before reading their values
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const selectedRegion = regionFilter ? regionFilter.value : '';
    const selectedStatus = statusFilter ? statusFilter.value : '';
    const selectedRisk = riskFilter ? riskFilter.value : '';

    filteredLpaData = allLpaData.filter(lpa => {
        const nameMatch = !searchTerm || (lpa.name && lpa.name.toLowerCase().includes(searchTerm));
        const regionMatch = !selectedRegion || lpa.region === selectedRegion;
        const statusMatch = !selectedStatus || lpa.status_code === selectedStatus;
        const riskMatch = !selectedRisk || lpa.plan_risk_score?.toString() === selectedRisk; // Handle potential null/undefined

        return nameMatch && regionMatch && statusMatch && riskMatch;
    });

    // Check details panel state
    if (detailsPanel && detailsPanel.style.display !== 'none') {
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
    // Checks are implicitly handled by functions called below
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
            return statusCode ? String(statusCode).replace(/_/g, ' ') : 'Unknown'; // Handle null/undefined and format unknowns
    }
}

/**
 * Populates the table with LPA data.
 */
function populateTable(data) {
    if (!tableBody) return; // Guard clause
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
    // Ensure detailsPanel exists before trying to display
    if (!row || !row.dataset.lpaId || !detailsPanel) return;

    const lpaId = row.dataset.lpaId;
    displayLpaDetails(lpaId);
}

/**
 * Finds LPA data by ID and displays it in the details panel.
 */
function displayLpaDetails(lpaId) {
    const lpa = allLpaData.find(item => item.id === lpaId);
    // Ensure all required detail elements exist before proceeding
    if (!lpa || !detailsPanel || !detailsLpaName || !detailsPlanStatus || !detailsStatusCode ||
        !detailsYearsSince || !detailsUpdateProgress || !detailsNppfDefault || !detailsNotes || !detailsReferences) {
            console.warn("Cannot display details, LPA data or detail panel elements missing.");
            return;
        }

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
    // Optional: Scroll the details panel into view if needed, especially on mobile
    // detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // Uncomment if needed

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
        // Clear content (check if elements exist first)
        if(detailsLpaName) detailsLpaName.textContent = '--';
        if(detailsPlanStatus) detailsPlanStatus.textContent = '--';
        if(detailsStatusCode) detailsStatusCode.textContent = '--';
        if(detailsYearsSince) detailsYearsSince.textContent = '--';
        if(detailsUpdateProgress) detailsUpdateProgress.textContent = '--';
        if(detailsNppfDefault) detailsNppfDefault.textContent = '--';
        if(detailsNotes) detailsNotes.textContent = '--';
        if(detailsReferences) detailsReferences.innerHTML = '<p>No references available.</p>';

        // TODO: Remove highlight from table row
        // TODO: Reset map view if needed
    }
}

/**
 * Calculates and displays the coverage statistics.
 */
function calculateAndDisplayStats(data) {
    const total = data.length;
    // Ensure stat elements exist before updating
    if (!statAdoptedCurrent || !statAdoptedOutdated || !statNoPlan) return;

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
        (lpa.notes || '').replace(/[\r\n]+/g, ' ') // Replace newlines in notes for CSV
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

// --- End of script ---