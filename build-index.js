// build-hybrid-index.js
// Run with Node.js: node build-hybrid-index.js
// Requires: npm install @xenova/transformers fs path cheerio lunr

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const lunr = require('lunr'); // *** Import Lunr ***
const { pipeline } = require('@xenova/transformers');

// Configuration
const pagesDir = path.join(__dirname, 'lpa-pages');
const semanticOutputFile = path.join(__dirname, 'semantic-index.json');
const lunrOutputFile = path.join(__dirname, 'lunr-index.json'); // *** New Lunr output file ***
const modelName = 'Xenova/all-MiniLM-L6-v2';

async function generateIndexes() {
    console.log(`Starting index generation for files in: ${pagesDir}`);

    // 1. Load the sentence transformer model
    let generateEmbedding;
    try {
        console.log(`Loading embedding model: ${modelName}...`);
        generateEmbedding = await pipeline('feature-extraction', modelName);
        console.log('Embedding model loaded.');
    } catch (error) {
        console.error(`Fatal error loading embedding model: ${error.message}`);
        return; // Stop if model can't load
    }


    const semanticIndexData = []; // For embeddings and metadata
    const documentsForLunr = []; // For Lunr text indexing

    let files;
    try {
        files = fs.readdirSync(pagesDir).filter(file => file.endsWith('.html'));
    } catch (err) {
        console.error(`Error reading directory ${pagesDir}: ${err.message}`);
        return;
    }

    console.log(`Found ${files.length} HTML files to process...`);

    for (const file of files) {
        const filePath = path.join(pagesDir, file);
        console.log(`Processing: ${file}`);
        let fileContent;
        try {
            fileContent = fs.readFileSync(filePath, 'utf-8');
        } catch (err) {
            console.error(`  Error reading file ${file}: ${err.message}`);
            continue;
        }

        const $ = cheerio.load(fileContent);

        // --- Extract Content ---
        const title = $('h1').first().text() || $('title').text() || file;
        let body = '';
         // Try specific content areas first, then fallback
         if ($('main').length) {
             body = $('main').text();
         } else if ($('.content').length) { // Example fallback class
             body = $('.content').text();
         } else {
             body = $('body').text(); // Last resort
         }

        // Basic cleaning
        body = body.replace(/\s\s+/g, ' ').replace(/(\r\n|\n|\r)/gm, " ").trim();
        const cleanTitle = title.trim();
        const docId = file; // Using filename as the unique ID

        if (!body && !cleanTitle) {
             console.warn(`  Skipping ${file}: No text content found.`);
             continue;
        }

        // --- Prepare data for Lunr ---
        documentsForLunr.push({
            id: docId,
            title: cleanTitle,
            body: body.substring(0, 5000), // Limit body length for Lunr index size
            path: `lpa-pages/${file}`
        });

        // --- Prepare data and generate embedding for Semantic Index ---
        let embedding = []; // Default to empty array
        const textToEmbed = (cleanTitle + " " + body).trim(); // Combine title and body for embedding

        if (textToEmbed) {
            try {
                 console.log(`  Generating embedding for: ${cleanTitle}`);
                 const output = await generateEmbedding(textToEmbed, {
                     pooling: 'mean',
                     normalize: true,
                 });
                 embedding = Array.from(output.data); // *** Convert Float32Array to standard Array ***

            } catch (err) {
                console.error(`  Error generating embedding for ${file}: ${err.message}. Skipping embedding.`);
                // Keep embedding as empty array []
            }
        } else {
             console.warn(`  Skipping embedding generation for ${file}: No text to embed.`);
        }


        semanticIndexData.push({
            id: docId,
            title: cleanTitle,
            path: `lpa-pages/${file}`,
             // Add a small snippet of body for potential display later
             body_snippet: body.substring(0, 200),
            embedding: embedding // Store the embedding (might be empty array if error occurred)
        });
    } // End file loop

    // --- 2. Build and Serialize Lunr Index ---
    console.log('\nBuilding Lunr keyword index...');
    try {
        const lunrIndex = lunr(function () {
            this.ref('id'); // Document reference field
            this.field('title', { boost: 10 }); // Boost matches in title
            this.field('body');
             this.field('path'); // Index path slightly

            // Add metadata for retrieving path later (optional but useful)
             this.metadataWhitelist = ['position']

            documentsForLunr.forEach(doc => {
                 // Check if doc is valid before adding
                 if(doc && doc.id && doc.title) {
                     this.add(doc);
                 } else {
                     console.warn(`  Skipping invalid doc for Lunr:`, doc);
                 }
            });
        });

        const serializedLunrIndex = JSON.stringify(lunrIndex);
        fs.writeFileSync(lunrOutputFile, serializedLunrIndex);
        console.log(`Lunr keyword index saved to: ${lunrOutputFile}`);
    } catch(error) {
         console.error(`Error building or saving Lunr index: ${error.message}`);
    }


    // --- 3. Save Semantic Index ---
    console.log('\nSaving semantic index...');
    try {
        // We'll also store the plain text docs map here for easy lookup client-side
        const finalSemanticOutput = {
             documents: semanticIndexData // Keep the array structure
        };
        fs.writeFileSync(semanticOutputFile, JSON.stringify(finalSemanticOutput, null, 2));
        console.log(`Semantic index saved to: ${semanticOutputFile}`);
    } catch (err) {
        console.error(`Error writing semantic index to ${semanticOutputFile}: ${err.message}`);
    }

    console.log('\nIndex generation complete.');
}

generateIndexes();