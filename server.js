import express from 'express';
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

//const express = require('express');
//const fs = require('fs');
//const readline = require('readline');

// Fix 2: Use absolute pathing so Linux/Render always finds the file in the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.urlencoded({ extended: true }));

const CSV_FILE = path.join(__dirname, 'optional_species.csv');

async function getAvailableSpecies() {
    const speciesList = [];
    if (!fs.existsSync(CSV_FILE)) return speciesList;

    const fileStream = fs.createReadStream(CSV_FILE);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let isHeader = true;
    for await (const line of rl) {
        if (isHeader) { isHeader = false; continue; }
        const parts = line.split(',');
        const species = parts[0]?.trim();
        const count = parseInt(parts[1], 10);

        if (species && !isNaN(count) && count >= 32) {
            speciesList.push({ species, count });
        }
    }
    return speciesList;
}

// Helper: Update stock count & organization selections
async function processOrder(organization, selections) {
    const fileStream = fs.createReadStream(CSV_FILE);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const updatedLines = [];
    let isHeader = true;
    let headerCols = [];

    for await (const line of rl) {
        if (isHeader) {
            headerCols = line.split(',').map(c => c.trim());
            updatedLines.push(line);
            isHeader = false;
            continue;
        }

        const parts = line.split(',').map(p => p.trim());
        const speciesName = parts[0];
        let stockCount = parseInt(parts[1], 10) || 0;

        if (selections[speciesName]) {
            const quantity = parseInt(selections[speciesName], 10) || 1;
            
            // Deduct total stock (32 per arboretum)
            stockCount = Math.max(0, stockCount - (32 * quantity));
            parts[1] = stockCount.toString();

            // Increment selected organization's count column
            const orgIndex = headerCols.indexOf(organization);
            if (orgIndex !== -1) {
                const currentOrgCount = parseInt(parts[orgIndex], 10) || 0;
                parts[orgIndex] = (currentOrgCount + quantity).toString();
            }
        }

        updatedLines.push(parts.join(','));
    }

    fs.writeFileSync(CSV_FILE, updatedLines.join('\n'));
}

// -------------------------------------------------------------
// ROUTE 1: Main Selection Form
// -------------------------------------------------------------
app.get('/', async (req, res) => {
    const availableSpecies = await getAvailableSpecies();

    if (availableSpecies.length === 0) {
        return res.send(`
            <div style="text-align: center; font-family: Arial, sans-serif; margin-top: 100px;">
                <h2>No species currently available (all have fewer than 32 seedlings).</h2>
                <a href="/admin">View Admin Dashboard</a>
            </div>
        `);
    }

    let speciesOptionsHtml = availableSpecies.map((item, index) => {
        const maxArboreta = Math.floor(item.count / 32);
        
        // Cap the maximum selectable options to 4 (or available stock if less than 4)
        const allowedMax = Math.min(4, maxArboreta);

        let selectOptions = '';
        for (let q = 1; q <= allowedMax; q++) {
            selectOptions += `<option value="${q}">${q}</option>`;
        }

        return `
            <div style="margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <input type="checkbox" id="choice${index}" name="species" value="${item.species}">
                    <label for="choice${index}" style="font-size: 1.05em; cursor: pointer; margin-left: 6px;">
                        <strong>${item.species}</strong> 
                        <span style="color: #d9534f; font-size: 0.8em; margin-left: 6px;">
                            (${item.count} seedlings available)
                        </span>
                    </label>
                </div>
                <div>
                    <label style="font-size: 0.85em; color: #555; margin-right: 4px;">Arboreta:</label>
                    <select name="qty_${item.species}" style="padding: 4px 8px; font-size: 0.9em; border-radius: 4px; border: 1px solid #ccc;">
                        ${selectOptions}
                    </select>
                </div>
            </div>
        `;
    }).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Nursery Tree Selection</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    background-color: #f9f9f9;
                }
                .container {
                    background: #ffffff;
                    padding: 30px 40px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    max-width: 540px;
                    width: 100%;
                }
                .section-title {
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: #333;
                    border-bottom: 2px solid #eee;
                    padding-bottom: 6px;
                }
                .org-select {
                    width: 100%;
                    padding: 8px;
                    font-size: 1em;
                    border-radius: 4px;
                    border: 1px solid #ccc;
                    margin-bottom: 25px;
                }
                button {
                    background-color: #28a745;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    font-size: 1em;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                    margin-top: 15px;
                }
                button:hover { background-color: #218838; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2 style="text-align: center; margin-top: 0;">Nursery Selection Form</h2>
                
                <form action="/select" method="POST">
                    <!-- Question 1: Organization -->
                    <div class="section-title">Question 1: Select Your Organization</div>
                    <select name="organization" class="org-select" required>
                        <option value="" disabled selected>-- Select Organization --</option>
                        <option value="NEIKER">NEIKER</option>
			<option value="HAZI">HAZI</option>
			<option value="XERA">XERA</option>
			<option value="INRAE">INRAE</option>
                        <option value="DRAAC">DRAAC</option>
                        <option value="CNPF">CNPF</option>
			<option value="ISA">ISA</option>
			<option value="OREKAN">OREKAN</option>
			<option value="ADRA">ADRA</option>
			<option value="WFC">WFC</option>
			<option value="U Sevilla">U Sevilla</option>
                    </select>

                    <!-- Question 2: Species Selection -->
                    <div class="section-title">Question 2: Select Species & Quantity</div>
                    <p style="color: #666; font-size: 0.85em; margin-bottom: 15px;">
                        Each arboretum reserves 32 seedlings.
                    </p>
                    ${speciesOptionsHtml}

                    <button type="submit">Submit Order</button>
                </form>

                <div style="text-align: center; margin-top: 20px;">
                    <a href="/admin" style="font-size: 0.85em; color: #007bff; text-decoration: none;">📊 View Admin Results</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// -------------------------------------------------------------
// ROUTE 2: Form Submission Handling
// -------------------------------------------------------------
app.post('/select', async (req, res) => {
    const organization = req.body.organization;
    const selectedSpecies = req.body.species;

    if (!organization) {
        return res.status(400).send('<h2>Error: Please select an organization.</h2><a href="/">Back</a>');
    }
    if (!selectedSpecies) {
        return res.status(400).send('<h2>Error: Please select at least one species.</h2><a href="/">Back</a>');
    }

    const speciesArray = Array.isArray(selectedSpecies) ? selectedSpecies : [selectedSpecies];

    const selections = {};
    const summaryList = [];

    speciesArray.forEach(name => {
        const qtyKey = `qty_${name}`;
        let qty = parseInt(req.body[qtyKey], 10) || 1;
        
        // Enforce backend cap of 4
        if (qty > 4) qty = 4;
        if (qty < 1) qty = 1;

        selections[name] = qty;
        summaryList.push(`${name} (${qty} arboretum/s = ${qty * 32} seedlings)`);
    });

    await processOrder(organization, selections);

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                .container { text-align: center; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                ul { text-align: left; display: inline-block; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2 style="color: #28a745;">Success!</h2>
                <p>Order recorded for organization: <strong>${organization}</strong></p>
                <ul>${summaryList.map(item => `<li>${item}</li>`).join('')}</ul>
                <br><br>
                <a href="/">Back to Form</a> | <a href="/admin">View Admin Dashboard</a>
            </div>
        </body>
        </html>
    `);
});

// -------------------------------------------------------------
// ROUTE 3: Admin Dashboard
// -------------------------------------------------------------
app.get('/admin', async (req, res) => {
    if (!fs.existsSync(CSV_FILE)) {
        return res.send('<h2>No CSV file found.</h2>');
    }

    const fileStream = fs.createReadStream(CSV_FILE);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let headers = [];
    let tableRowsHtml = '';
    let isHeader = true;

    for await (const line of rl) {
        const cols = line.split(',').map(c => c.trim());
        if (isHeader) {
            headers = cols;
            isHeader = false;
            continue;
        }

        if (cols[0]) {
            const species = cols[0];
            const stockRemaining = parseInt(cols[1], 10);
            
            const orgCells = cols.slice(2).map(val => `<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${val}</td>`).join('');

            tableRowsHtml += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; text-align: left;">${species}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: ${stockRemaining < 32 ? '#d9534f' : '#28a745'}; font-weight: bold;">
                        ${stockRemaining}
                    </td>
                    ${orgCells}
                </tr>
            `;
        }
    }

    const headerHtml = headers.map(h => `<th style="padding: 12px; background: #f2f2f2; border: 1px solid #ccc; text-align: center;">${h}</th>`).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Dashboard</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; background-color: #f9f9f9; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                a { color: #007bff; text-decoration: none; margin: 0 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Admin Dashboard: Inventory & Organization Selections</h2>
                <table>
                    <thead><tr>${headerHtml}</tr></thead>
                    <tbody>${tableRowsHtml}</tbody>
                </table>
                <br>
                <a href="/">← Back to Form</a> | <a href="/reset">🔄 Reset Inventory Data</a>
            </div>
        </body>
        </html>
    `);
});

// ROUTE 4 -------------------------------------------------------------
app.get('/reset', (req, res) => {
    // Keeps only the CSV headers (no predefined species)
    const blankData = `Species,Number,NEIKER,HAZI,XERA,INRAE,DRAAC,CNPF,ISA,OREKAN,ADRA,WFC,Sevilla`;  
    fs.writeFileSync(CSV_FILE, blankData);

    res.send(`
        <div style="text-align: center; font-family: Arial, sans-serif; margin-top: 100px;">
            <h2>Inventory wiped clean!</h2>
            <p>The form is now blank and ready for new species setup.</p>
            <a href="/admin">Go to Admin Dashboard</a> | <a href="/">Go to Form</a>
        </div>
    `);
});

// ROUTE 5: Add New Species Page
app.get('/add-species', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Add Species</title></head>
        <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; padding-top: 50px;">
            <div style="text-align: center; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px; width: 100%;">
                <h2>Add New Species</h2>
                <form action="/add-species" method="POST">
                    <div style="margin-bottom: 15px; text-align: left;">
                        <label>Species Name:</label><br>
                        <input type="text" name="species" required style="width: 100%; padding: 8px; margin-top: 4px;">
                    </div>
                    <div style="margin-bottom: 20px; text-align: left;">
                        <label>Initial Seedlings Count:</label><br>
                        <input type="number" name="number" required min="32" style="width: 100%; padding: 8px; margin-top: 4px;">
                    </div>
                    <button type="submit" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; width: 100%;">
                        Add Species
                    </button>
                </form>
                <br>
                <a href="/admin">Back to Admin</a>
            </div>
        </body>
        </html>
    `);
});

app.post('/add-species', (req, res) => {
    const { species, number } = req.body;
    const newRow = `\n${species.trim()},${number},0,0,0`;

    fs.appendFileSync(CSV_FILE, newRow);

    res.redirect('/admin');
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
