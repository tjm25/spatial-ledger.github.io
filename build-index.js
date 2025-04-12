// build-semantic-index.js (Run with Node.js: node build-semantic-index.js)
// Requires: npm install @xenova/transformers fs path cheerio

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { pipeline } = require('@xenova/transformers');

// Configuration
const pagesDir = path.join(__dirname, 'lpa-pages'); // Directory with your HTML files
const outputFile = path.join(__dirname, 'semantic-index.json');
const modelName = 'Xenova/all-MiniLM-L6-v2'; // A good, relatively small sentence transformer

async function generateEmbeddings() {
    console.log(`Starting embedding generation for files in: ${pagesDir}`);

    // 1. Load the sentence transformer model
    const generateEmbedding = await pipeline('feature-extraction', modelName, {
        pooling: 'mean', // Use mean pooling for the sentence embedding
    });

    const searchIndex = [];
    let files;

    try {
        // 2. Read HTML files from the directory
        files = fs.readdirSync(pagesDir).filter(file => file.endsWith('.html'));
    } catch (err) {
        console.error(`Error reading directory: ${err.message}`);
        return; // Exit if directory reading fails
    }


    for (const file of files) {
        const filePath = path.join(pagesDir, file);
        let fileContent;

        try {
            fileContent = fs.readFileSync(filePath, 'utf-8');
        } catch (err) {
            console.error(`Error reading file ${file}: ${err.message}`);
            continue; // Skip to the next file
        }

        const $ = cheerio.load(fileContent);

        // 3. Extract text content (simple extraction)
        let text = $('main').text(); // Get text from <main>
        if (!text) {
            text = $('body').text(); // If no <main>, try <body>
        }
        text = text.replace(/\s+/g, ' ').trim(); // Clean whitespace

        if (!text) {
            console.warn(`Skipping ${file}: No text found in <main> or <body>.`);
            continue; // Skip file if no text
        }
        const title = $('h1').first().text() || $('title').text() || file;


        try {
             // 4. Generate the embedding
            const output = await generateEmbedding(text, {
                pooling: 'mean',
                normalize: true,
            });

            // The output is an array of arrays.  We want the first one.
            const embedding = output.data;

            // 5. Add to index
            searchIndex.push({
                id: file,
                title: title.trim(),
                path: `lpa-pages/${file}`, // Adjust as needed
                embedding: embedding, // The vector
            });

            console.log(`Generated embedding for: ${file} -  ${title}`);

        } catch (err) {
            console.error(`Error generating embedding for ${file}: ${err.message}`);
            continue; // Skip to the next file
        }


    }

    // 6. Save the index to JSON
    try {
        fs.writeFileSync(outputFile, JSON.stringify(searchIndex, null, 2));
        console.log(`\nSemantic search index saved to: ${outputFile}`);
    } catch (err) {
        console.error(`Error writing to ${outputFile}: ${err.message}`);
    }
}

// Run the function
generateEmbeddings();