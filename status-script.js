// --- status-script.js ---

// --- Configuration & State ---
const dataURL = 'status-data.json';
const currentYear = new Date().getFullYear();
let lpaData = []; // To store fetched data

// --- DOM Elements ---
const tableBody = document.getElementById('status-table-body');
const filterInput = document.getElementById('status-filter');
const notesDisplaySection = document.getElementById('lpa-notes-display');
const notesLpaName = document.getElementById('notes-lpa-name');
const notesContent = document.getElementById('notes-content');
const closeNotesBtn = document.getElementById('close-notes-btn');

// --- Functions ---

/**
 * Fetches LPA status data from the JSON file.
 */
async function fetchData() {
    try {
        const response = await fetch(dataURL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        lpaData = await response.json();
        console.log(`Workspaceed ${lpaData.length} LPA records.`);
        // Calculate dynamic fields after fetching
        lpaData.forEach(lpa => {
            lpa.years_since_adoption = calculateYearsSince(lpa.last_adoption_year);
        });
        populateTable(lpaData);
    } catch (error) {
        console.error("Error fetching status data:", error);
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="9" class="error-message">Error loading data. Please try again later.</td></tr>`;
        }
    }
}

/**
 * Calculates years since adoption.
 * @param {number|null} adoptionYear - The year the plan was adopted.
 * @returns {number|string} - Years since adoption or 'N/A'.
 */
function calculateYearsSince(adoptionYear) {
    if (typeof adoptionYear === 'number' && adoptionYear > 1900 && adoptionYear <= currentYear) {
        return currentYear - adoptionYear;
    }
    return 'N/A';
}

/**
 * Maps status codes to user-friendly display text.
 * @param {string} statusCode - The internal status code.
 * @returns {string} User-friendly status text.
 */
function formatStatusCode(statusCode) {
    switch (statusCode) {
        case 'adopted_recent':
            return 'Adopted (Recent)';
        case 'adopted_outdated':
            return 'Adopted (Outdated)';
        case 'emerging_in_progress':
            return 'Emerging (In Progress)';
        case 'withdrawn_or_vacuum':
            return 'Withdrawn / Vacuum';
        case 'just_adopted_updating':
            return 'Adopted (Updating)';
        case 'unknown':
        default:
            // Handle null or undefined explicitly
            if (statusCode === null || typeof statusCode === 'undefined') {
                 return 'Unknown';
            }
            // Return the code itself if it's unexpected but not null/undefined
            return statusCode;
    }
}


/**
 * Populates the table with LPA data.
 * @param {Array} data - Array of LPA objects.
 */
function populateTable(data) {
    if (!tableBody) {
        console.error("Table body not found!");
        return;
    }
    tableBody.innerHTML = ''; // Clear loading/previous data

    if (!Array.isArray(data) || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9">No LPA data found or loaded.</td></tr>`;
        return;
    }

    data.forEach(lpa => {
        const row = tableBody.insertRow();
        row.dataset.lpaId = lpa.id || `lpa-${Math.random().toString(36).substr(2, 9)}`; // Fallback ID
        row.dataset.notes = lpa.notes_short || '';
        row.dataset.lpaName = lpa.name || 'Unknown LPA';

        // Create cells (match the order in status.html thead)
        createCell(row, lpa.name || 'N/A');
        createCell(row, lpa.plan_status || 'N/A');

        // Status Code cell with dynamic class & friendly text
        const currentStatusCode = lpa.status_code || 'unknown';
        const statusText = formatStatusCode(currentStatusCode);
        const statusCell = createCell(row, statusText);
        statusCell.classList.add('status-cell', `status-${currentStatusCode}`);
        statusCell.title = `Status Code: ${currentStatusCode}`; // Tooltip shows raw code

        createCell(row, formatBoolean(lpa.up_to_date), true);
        createCell(row, lpa.last_adoption_year || 'N/A', true);
        createCell(row, lpa.years_since_adoption, true); // Use calculated value
        createCell(row, formatBoolean(lpa.update_in_progress), true);
        createCell(row, formatBoolean(lpa.nppf_defaulting), true);
        createCell(row, lpa.plan_risk_score ?? 'N/A', true);
    });
}

/**
 * Helper to create and append a table cell.
 */
function createCell(row, text, center = false) {
    const cell = row.insertCell();
    cell.textContent = text;
    if (center) {
        cell.classList.add('center');
    }
    return cell;
}

/**
 * Formats boolean values for display.
 */
function formatBoolean(value) {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'N/A';
}

/**
 * Filters the table based on the input value.
 */
function filterTable() {
    if (!filterInput || !tableBody) return;

    const filter = filterInput.value.toLowerCase();
    const rows = tableBody.getElementsByTagName('tr');

    for (const row of rows) {
        // Ensure row has cells before proceeding
        if (row.cells.length < 2) continue;

        const nameCell = row.cells[0];
        const statusTextCell = row.cells[1]; // Use the user-friendly status text cell
        const shouldShow = (nameCell && nameCell.textContent.toLowerCase().includes(filter)) ||
                           (statusTextCell && statusTextCell.textContent.toLowerCase().includes(filter));

        row.style.display = shouldShow ? '' : 'none';
    }
}

/**
 * Shows the notes for a clicked LPA row.
 */
function showNotes(event) {
    const row = event.target.closest('tr');
    if (!row || !row.dataset.lpaId || !notesDisplaySection || !notesLpaName || !notesContent) return;

    const notes = row.dataset.notes;
    const name = row.dataset.lpaName;

    if (notes && name) {
        notesLpaName.textContent = name;
        notesContent.textContent = notes;
        notesDisplaySection.style.display = 'block';
        notesDisplaySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        // If notes are empty/missing, still show the section but indicate no notes?
        notesLpaName.textContent = name;
        notesContent.textContent = "No specific notes available for this LPA.";
        notesDisplaySection.style.display = 'block';
        notesDisplaySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Or hide completely: hideNotes();
    }
}

/**
 * Hides the notes display section.
 */
function hideNotes() {
    if (notesDisplaySection) {
        notesDisplaySection.style.display = 'none';
        notesLpaName.textContent = '';
        notesContent.textContent = '';
    }
}

// --- Event Listeners ---
// Fetch data only after the DOM is loaded
document.addEventListener('DOMContentLoaded', fetchData);

if (filterInput) {
    let filterTimeout;
    filterInput.addEventListener('input', () => {
        clearTimeout(filterTimeout);
        // Debounce filtering
        filterTimeout = setTimeout(filterTable, 200);
    });
}

if (tableBody) {
    tableBody.addEventListener('click', showNotes); // Use event delegation
}

if (closeNotesBtn) {
    closeNotesBtn.addEventListener('click', hideNotes);
}