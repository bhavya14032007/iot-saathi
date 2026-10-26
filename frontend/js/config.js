/**
 * IoT Saathi - Global Client Configuration
 * Sets the central backend and database service endpoints for all devices.
 */

window.IOT_SAATHI_CONFIG = {
    // Render Database Service URL (once deployed on Render, update this URL so all devices connect)
    DATABASE_URL: 'https://iot-saathi-db.onrender.com',

    // Prompt Engine API URL (Backend on Render)
    API_URL: 'https://iot-saathi-api.onrender.com'
};
