// const express = require('express');
// const bodyParser = require('body-parser');
// const app = express();
// const port = 3000;

// // Middleware
// app.use(bodyParser.json());
// app.use(express.static('public'));

// // Utility function to generate documentation
// function generateDocumentation(data) {
//     return `
//     1. Update the DB Config data for the selected export system (${data.exportSystem}):
//        - 1. select * from SysExportTargetSystem;
//        - 2. select * from SysExportDataType;
//        - 3. select * from SysExportFormat;
//        - 4. select * from ExportFormat;
//        - 5. select * from Tenant;
//        - 6. select * from ProjectExport;
    
//     2. Within the migrations file -> stored procedures:
//        - Create a separate file for the new export: ${data.exportSystem}
//        - Code accordingly for the export.
//     `;
// }

// // Utility function to generate SQL queries
// function generateSQLQuery(data) {
//     return `
//     UPDATE ExportFormat
//     SET
//         otherExportName = '${data.otherExportName || 'N/A'}',
//         hasOtherExport = ${data.otherExport === 'Yes' ? 1 : 0},
//         hasEquipmentExport = ${data.hasEquipmentExport === 'Yes' ? 1 : 0},
//         targetOutBucket_Other = 'RT70efdf2e/int/py/out/IND/oth',
//         targetHistBucket_Other = 'RT70efdf2e/int/py/out/IND/hist/oth',
//         dataExtractStoredProcedureNameOther = 'usp_ExportsPayroll_CreateCustom_Tenant_RT70efdf2e_Other',
//         updated_by = 'migration',
//         updated_at = CURRENT_TIMESTAMP
//     WHERE
//         id = 34;
    
//     -- File will be saved with the extension: ${data.fileExtension}
//     `;
// }

// // Handle POST request to process form data
// app.post('/process', (req, res) => {
//     const data = req.body;

//     // Generate documentation and SQL based on user input
//     const documentation = generateDocumentation(data);
//     const sqlQuery = generateSQLQuery(data);

//     // Send the result back as a JSON response
//     res.json({
//         documentation,
//         sqlQuery
//     });
// });

// // Start the server
// app.listen(port, () => {
//     console.log(`Server is running on http://localhost:${port}`);
// });

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const app = express();
const OpenAI = require('openai');
require('dotenv').config();  // To load environment variables from a .env file


// Middleware to parse JSON request bodies
app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Define a route for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY  // Ensure the .env file contains the correct API key
});

// Generate SQL query with OpenAI
async function generateSQLQueryWithOpenAI(prompt) {
    console.log("checking here", prompt);

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",  // Use the GPT model (or you can use gpt-4 if available)
            messages: [{ role: "system", content: "You are a SQL expert." }, { role: "user", content: prompt }],
            max_tokens: 1000,
            temperature: 0.7,
        });

        return response.choices[0].message.content.trim();  // Return the generated SQL query
    } catch (error) {
        console.error('Error generating SQL query with OpenAI:', error);
        throw error;
    }
}

// Handle POST request to process form data
app.post('/process', async (req, res) => {
    const data = req.body;

    try {
        // Generate documentation
        const documentation = `
            1. Update the DB Config data (For the 6 tables):
            - select * from SysExportTargetSystem;
            - select * from SysExportDataType;
            - select * from SysExportFormat;
            - select * from ExportFormat;
            - select * from FileExtensions;
            - select * from TargetSystem.

            2. Other steps in export: Update config and server details.
        `;

        // Create prompts for SQL queries
        const exportFormatPrompt = `Create an update statement to ExportFormat table with setting these values exportTargetSystemKey = '${data.exportSystem}', exportFormatKey = '${data.exportFormatKey}', hasOtherExport = '${data.otherExport}', otherExportName = '${data.otherExportName}', hasEquipmentExport = '${data.hasEquipmentExport}', fileExtension = '${data.fileExtension}'`;
        const sysExportFormatPrompt = `Create an update statement to SysExportFormat table with setting these values fileNamePrefix = '${data.exportSystem}', csvOptions = '${JSON.stringify({
            labor: {
                eol: "\r\n",
                quote: data.quote === 'needed' ? '"' : '',
                header: data.header === 'true',
                delimiter: data.delimiter,
                footerRowCount: 0,
                headerRowCount: 1
            },
            target: "emque_py",
            equipment: {
                eol: "\r\n",
                quote: data.quote === 'needed' ? '"' : '',
                header: data.header === 'true',
                delimiter: data.delimiter,
                footerRowCount: 0,
                headerRowCount: 1
            }
        }).replace(/'/g, "\\'").replace(/"/g, "\\'")}'`;

        // Generate SQL queries using OpenAI
        const sqlQueryExportFormat = await generateSQLQueryWithOpenAI(exportFormatPrompt);
        const sqlQuerySysExportFormat = await generateSQLQueryWithOpenAI(sysExportFormatPrompt);

        // Handle SysExportTargetSystem query based on the condition
        let sqlQuerySysExportTargetSystem = '';
        if (data.exportSystem === 'Custom') {
            const sysExportTargetSystemPrompt = `Create an update statement to SysExportTargetSystem table with setting these values exportTargetSystemKey = '${data.exportTargetSystemKey}', exportTargetSystemVersion = '${data.version}', exportTargetSystemDescription = '${data.exportTargetSystemDescription}'`;
            sqlQuerySysExportTargetSystem = await generateSQLQueryWithOpenAI(sysExportTargetSystemPrompt);
        }

        // Send the result back as a JSON response
        res.json({
            documentation,
            sqlQuery: sqlQueryExportFormat, // or you can send multiple queries as needed
            sysExportFormatQuery: sqlQuerySysExportFormat,
            sysExportTargetSystemQuery: sqlQuerySysExportTargetSystem
        });
    } catch (error) {
        res.status(500).json({ error: 'Error generating SQL query' });
    }
});

// Start the server
const port = 4000; // Choose a port number
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
