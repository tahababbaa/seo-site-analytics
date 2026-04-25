const express = require('express');
const PORT = 3000;

process.on('uncaughtException', (err) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
    startErrorServer(err);
});

function startErrorServer(error) {
    try {
        const app = express();
        app.get('*', (req, res) => {
            res.status(500).send(`
                <h1>Application Failed to Start</h1>
                <pre style="white-space: pre-wrap; font-family: monospace;">${error.stack || error.message || error}</pre>
            `);
        });
        app.listen(PORT, '0.0.0.0', () => {
            console.log('Error server listening on port', PORT);
        });
    } catch (e) {
        console.error('Failed to start error server:', e);
    }
}

try {
    // Try to load the main app
    require('./app.js');
} catch (error) {
    console.error('STARTUP ERROR:', error);
    startErrorServer(error);
}