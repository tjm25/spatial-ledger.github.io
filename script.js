// Import the pipeline function directly from the CDN module
import { pipeline } from 'https://unpkg.com/@xenova/transformers@latest';

// --- DOM Elements ---
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchResultsContainer = document.getElementById('search-results');
const loadingIndicator = document.getElementById('loading-indicator');
const accordionGroup = document.querySelector('.accordion-group');

// --- State Variables ---
let embeddingModel = null;
let semanticIndexDocs = []; // Stores {id, title, path, embedding, body_snippet}
let lunrIndex = null;
let docMap = new Map(); // To easily access doc details by ID {id -> {id, title, path, body_snippet}}

let isModelReady = false;
let isSemanticIndexReady = false;
let isLunrIndexReady = false;

// --- Configuration ---
const modelName = 'Xenova/all-MiniLM-L6-v2';
const semanticIndexURL = 'semantic-index.json'; // Expects { documents: [...] }
const lunrIndexURL = 'lunr-index.json';
const similarityThreshold = 0.25; // Semantic relevance threshold
const maxResults = 20;
const rrf_k = 60; // Reciprocal Rank Fusion constant

// --- Accordion Functionality ---
if (accordionGroup) {
    accordionGroup.addEventListener('click', (event) => {
        const button = event.target.closest('.accordion-button');
        if (!button) return; // Exit if click wasn't on a button

        const accordion = button.parentElement;
        const isOpening = !accordion.classList.contains('open');
        // Close other accordions in the group
        const currentlyOpen = accordionGroup.querySelector('.accordion.open');
        if (currentlyOpen && currentlyOpen !== accordion) {
            currentlyOpen.classList.remove('open');
            currentlyOpen.querySelector('.accordion-button').setAttribute('aria-expanded', 'false');
        }

        accordion.classList.toggle('open');
        button.setAttribute('aria-expanded', isOpening);
    });
}


// --- Search Initialization ---
async function initializeSearch() {
    console.log('Initializing hybrid search...');
    loadingIndicator.textContent = 'Initializing search...';
    loadingIndicator.style.display = 'inline-block';
    searchInput.disabled = true;
    searchButton.disabled = true;

    try {
        const modelPromise = loadEmbeddingModel();
        const semanticPromise = loadSemanticIndex();
        const lunrPromise = loadLunrIndex();

        await Promise.all([modelPromise, semanticPromise, lunrPromise]);

        checkAndEnableSearch();

    } catch (error) {
        handleError(error, "Initialization failed. Search is unavailable.");
    } finally {
        // Hide indicator only if all are ready
        if (isModelReady && isSemanticIndexReady && isLunrIndexReady) {
            loadingIndicator.style.display = 'none';
        }
    }
}

async function loadEmbeddingModel() {
    if (isModelReady) return;
    console.log(`Loading embedding model: ${modelName}...`);
    loadingIndicator.textContent = 'Loading model...';
    // Use the imported pipeline function directly
    embeddingModel = await pipeline('feature-extraction', modelName, {
        quantized: true, // Use quantized model for faster loading
        progress_callback: data => {
            if (data.status === 'progress') {
                const percentage = (data.progress || 0).toFixed(2);
                loadingIndicator.textContent = `Loading model: ${percentage}%`;
            } else {
                loadingIndicator.textContent = `Model status: ${data.status}`;
            }
        }
    });
    console.log('Embedding model loaded successfully.');
    isModelReady = true;
}

async function loadSemanticIndex() {
    if (isSemanticIndexReady) return;
    console.log('Fetching semantic index...');
    loadingIndicator.textContent = 'Fetching semantic index...';
    const response = await fetch(semanticIndexURL);
    if (!response.ok) throw new Error(`Failed to fetch semantic index (${response.status})`);
    const data = await response.json();

    // Validate structure expecting { documents: [...] }
    if (!data || !Array.isArray(data.documents)) {
        console.error("Invalid semantic index structure:", data);
        throw new Error("Semantic index format invalid (expected { documents: [...] }).");
    }
    semanticIndexDocs = data.documents;

    // Build the docMap and validate embeddings
    docMap.clear();
    let validEmbeddings = 0;
    semanticIndexDocs.forEach(doc => {
        // Store basic info for lookup
        docMap.set(doc.id, {
            id: doc.id,
            title: doc.title,
            path: doc.path,
            body_snippet: doc.body_snippet || ""
        });
        // Basic validation of embedding structure - expects Array now
        if (doc.embedding && Array.isArray(doc.embedding) && doc.embedding.length > 0) {
            validEmbeddings++;
        } else {
            // console.warn(`Document ${doc.id} has missing or invalid embedding.`);
            doc.embedding = []; // Ensure it's an empty array for safety
        }
    });
    console.log(`Semantic index fetched successfully (${semanticIndexDocs.length} docs, ${validEmbeddings} valid embeddings).`);
    isSemanticIndexReady = true;
}

async function loadLunrIndex() {
    if (isLunrIndexReady) return;
    console.log('Fetching Lunr index...');
    loadingIndicator.textContent = 'Fetching keyword index...';
    const response = await fetch(lunrIndexURL);
    if (!response.ok) throw new Error(`Failed to fetch Lunr index (${response.status})`);
    const serializedIndex = await response.text();
    // Make sure Lunr is loaded (global from script tag)
    if (typeof lunr === 'undefined') {
        throw new Error("Lunr library is not loaded. Check script tag in HTML <head>.");
    }
    lunrIndex = lunr.Index.load(JSON.parse(serializedIndex));
    console.log('Lunr index loaded successfully.');
    isLunrIndexReady = true;
}


// --- 2. Check if ready and enable form ---
function checkAndEnableSearch() {
    if (isModelReady && isSemanticIndexReady && isLunrIndexReady) {
        console.log('Hybrid search system ready.');
        searchInput.disabled = false;
        searchButton.disabled = false;
        loadingIndicator.style.display = 'none';
        searchInput.placeholder = "Search the ledger...";
    } else {
        // Provide more specific loading status
        if (!isModelReady) loadingIndicator.textContent = 'Loading model...';
        else if (!isSemanticIndexReady) loadingIndicator.textContent = 'Loading semantic index...';
        else if (!isLunrIndexReady) loadingIndicator.textContent = 'Loading keyword index...';
    }
}

// --- 3. Perform Search ---
async function performSearch(query) {
    if (!isModelReady || !isSemanticIndexReady || !isLunrIndexReady) {
        handleError(new Error("Search components not ready"), "Search is not yet available. Please wait.");
        return;
    }
    if (!query) {
        searchResultsContainer.innerHTML = ''; return;
    }

    console.log(`Performing hybrid search for: "${query}"`);
    loadingIndicator.textContent = 'Searching...';
    loadingIndicator.style.display = 'inline-block';
    searchButton.disabled = true;
    searchResultsContainer.innerHTML = '';

    try {
        // --- Semantic Search (Promise) ---
        const semanticSearchPromise = (async () => {
            console.time('Semantic Search');
            const queryEmbedding = await generateEmbedding(query);
            let results = [];
            if (queryEmbedding) {
                results = semanticIndexDocs
                    .map(item => ({
                        id: item.id,
                        // Use the embedding array directly now
                        similarity: (Array.isArray(item.embedding) && item.embedding.length > 0)
                            ? cosineSimilarity(queryEmbedding, item.embedding)
                            : -1
                    }))
                    .filter(item => item.similarity >= similarityThreshold);

                results.sort((a, b) => b.similarity - a.similarity);
            } else {
                console.warn("Could not generate query embedding for semantic search.");
            }
            console.timeEnd('Semantic Search');
            return results; // Returns [{id, similarity}, ...] sorted
        })();


        // --- Keyword Search (Promise) ---
        const keywordSearchPromise = (async () => {
            console.time('Keyword Search');
            // Add wildcards for better matching? Example: query + '*' or query.split(' ').map(t=>t+'*').join(' ')
            const keywordResults = lunrIndex.search(query);
            console.timeEnd('Keyword Search');
            return keywordResults; // Returns [{ref: id, score: num, matchData: {...}}, ...]
        })();


        // --- Wait for both searches and Combine ---
        const [semanticResultsRanked, keywordResults] = await Promise.all([semanticSearchPromise, keywordSearchPromise]);

        console.time('Result Combination (RRF)');
        const combinedResults = combineResultsRRF(keywordResults, semanticResultsRanked, rrf_k);
        console.timeEnd('Result Combination (RRF)');

        displayResults(combinedResults, query, keywordResults); // Pass raw keyword results for highlighting data

    } catch (error) {
        handleError(error, "Search failed. Please try again.");
    } finally {
        loadingIndicator.style.display = 'none';
        searchButton.disabled = false; // Re-enable button
    }
}

// --- 4. Combine Results (Reciprocal Rank Fusion) ---
function combineResultsRRF(keywordResults, semanticResults, k = 60) {
    const rankedScores = new Map();

    // Process keyword results
    keywordResults.forEach((result, index) => {
        const rank = index + 1;
        const score = 1 / (k + rank);
        rankedScores.set(result.ref, (rankedScores.get(result.ref) || 0) + score);
    });

    // Process semantic results
    semanticResults.forEach((result, index) => {
        const rank = index + 1;
        const score = 1 / (k + rank); // Semantic gets equal weight here, adjust multiplier if needed (e.g., * 0.8)
        rankedScores.set(result.id, (rankedScores.get(result.id) || 0) + score);
    });

    // Convert Map to array, sort by score, and get original doc info
    const combined = Array.from(rankedScores.entries())
        .map(([id, score]) => ({ id, score }))
        .sort((a, b) => b.score - a.score); // Sort descending by RRF score

    console.log("Combined RRF Scores (Top 10):", combined.slice(0, 10));
    return combined; // Returns [{id, score}, ...] sorted
}


// --- 5. Display Results ---
function displayResults(combinedResults, query, keywordResultsRaw) {
    const keywordMatchData = new Map();
    keywordResultsRaw.forEach(res => keywordMatchData.set(res.ref, res.matchData));

    const resultCount = combinedResults.length;
    searchResultsContainer.innerHTML = `<h3>Found ${resultCount} result${resultCount !== 1 ? 's' : ''} for "${escapeHTML(query)}":</h3>`;

    if (resultCount === 0) {
        searchResultsContainer.innerHTML += `<p class="info-message">No relevant results found. Try different search terms.</p>`;
        return;
    }

    const ul = document.createElement('ul');
    combinedResults.slice(0, maxResults).forEach(item => {
        const doc = docMap.get(item.id); // Get full document info using the ID

        if (doc) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = doc.path;
            a.textContent = doc.title || doc.id; // Fallback to ID if title is missing
            li.appendChild(a);

            // Snippet generation
            const snippetP = document.createElement('p');
            snippetP.className = 'snippet';
            let snippetText = doc.body_snippet || "No preview available."; // Use snippet from index

            // Keyword highlighting logic
            let highlighted = false;
            const matchData = keywordMatchData.get(doc.id);
            if (matchData && query) {
                const terms = Object.keys(matchData.metadata);
                for (const term of terms) {
                    // Check if term is relevant to the query (simple substring match for demo)
                    if (query.toLowerCase().includes(term.toLowerCase())) {
                        const escapedTerm = escapeRegExp(term);
                        const regex = new RegExp(`(${escapedTerm})`, 'gi');
                        // Only highlight if term is actually in the snippet
                        if (snippetText.toLowerCase().includes(term.toLowerCase())) {
                            snippetP.innerHTML = escapeHTML(snippetText).replace(regex, '<mark>$1</mark>');
                            highlighted = true;
                            break; // Highlight first query term match found
                        }
                    }
                }
            }
            if (!highlighted) {
                snippetP.textContent = snippetText + (snippetText.length >= 200 ? '...' : ''); // Show plain snippet
            }
            li.appendChild(snippetP);


            // Optional: Display path and score
            const pathInfo = document.createElement('span');
            pathInfo.className = 'path-info';
            pathInfo.textContent = `Source: ${doc.path}`;
            li.appendChild(pathInfo);

            const scoreInfo = document.createElement('span');
            scoreInfo.className = 'similarity-score';
            // Show RRF score for debugging, might want to hide for users
            scoreInfo.textContent = `Score: ${item.score.toFixed(4)}`;
            li.appendChild(scoreInfo);


            ul.appendChild(li);
        } else {
            console.warn("Document details not found in docMap for ID:", item.id);
        }
    });
    searchResultsContainer.appendChild(ul);

    if (combinedResults.length > maxResults) {
        searchResultsContainer.innerHTML += `<p style="font-style: italic; color: #555; margin-top: 1em;">Showing top ${maxResults} results.</p>`;
    }
}

// --- 6. Helper Functions ---
async function generateEmbedding(text) {
    if (!embeddingModel) return null;
    try {
        console.time(`Embedding: ${text.substring(0, 20)}...`);
        const output = await embeddingModel(text, { pooling: 'mean', normalize: true });
        console.timeEnd(`Embedding: ${text.substring(0, 20)}...`);
        // output.data should be Float32Array, convert to standard array
        if (output && (output.data instanceof Float32Array || Array.isArray(output.data))) {
            return Array.from(output.data);
        } else {
            console.warn("Unexpected embedding output format:", output);
            return null;
        }
    } catch (error) {
        console.error("Error generating embedding:", error);
        return null;
    }
}

function cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || vecA.length === 0) {
        // console.warn("Invalid vectors for cosine similarity:", vecA, vecB);
        return 0;
    }
    let dotProduct = 0, magnitudeA = 0, magnitudeB = 0;
    try {
        for (let i = 0; i < vecA.length; i++) {
            const valA = Number(vecA[i]) || 0; // Coerce to number, default to 0 if NaN/undefined
            const valB = Number(vecB[i]) || 0;
            dotProduct += valA * valB;
            magnitudeA += valA * valA;
            magnitudeB += valB * valB;
        }
    } catch (e) {
        console.error("Error during similarity calculation:", e);
        return 0;
    }
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    if (magnitudeA && magnitudeB) {
        // Clamp the result between -1 and 1 to handle potential floating point inaccuracies
        return Math.max(-1, Math.min(1, dotProduct / (magnitudeA * magnitudeB)));
    } else {
        return 0; // Handle zero vector case
    }
}

function handleError(error, userMessage) {
    console.error("Search Error Details:", error); // Log the actual error
    searchResultsContainer.innerHTML = `<p class="error-message">${escapeHTML(userMessage)} (See console for details)</p>`;
    loadingIndicator.style.display = 'none';
    // Keep form disabled if initialization failed
    if (!isModelReady || !isSemanticIndexReady || !isLunrIndexReady) {
        searchButton.disabled = true;
        searchInput.disabled = true;
        searchInput.placeholder = "Search unavailable";
    } else {
        searchButton.disabled = false; // Re-enable only if search itself failed after init
    }
}

function escapeHTML(str) {
    const p = document.createElement("p"); p.textContent = str; return p.innerHTML;
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}


// --- 7. Event Listeners ---
searchForm.addEventListener('submit', (event) => {
    event.preventDefault(); // Prevent default form submission
    const query = searchInput.value.trim();
    performSearch(query);
});

// Optional: Debounced search on input
let debounceTimer;
searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const query = searchInput.value.trim();
        // Trigger search only if query is reasonably long or cleared
        if (query.length > 2 || query.length === 0) {
            performSearch(query);
        }
    }, 350); // 350ms delay
});

// --- 8. Initialize ---
// Since this is a module, script execution is deferred by default.
// We can call initializeSearch directly.
initializeSearch();