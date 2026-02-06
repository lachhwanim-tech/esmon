// googleApiHandler.js - Updated & Fixed

// ⚠️ यहाँ STEP 1 से मिला नया URL पेस्ट करें
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyKbUTKLME_t5Ccln-GvLaBeOyCXhlwRuRv8V7g2hyO-IVSkYkuOUCAZ0bkAOaQgULx/exec';

async function uploadDataAndFileToGoogle() {
    // --- 1. DEFINE ALLOWED HQS ---
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ'];

    // Get Current HQ
    const currentHq = document.getElementById('cliHqDisplay') ? document.getElementById('cliHqDisplay').value.trim().toUpperCase() : '';

    // --- 2. CHECK IF UPLOAD SHOULD BE SKIPPED ---
    if (!ALLOWED_HQS.includes(currentHq)) {
        console.log(`CLI HQ (${currentHq}) is not in the allowed list. Skipping Drive Upload.`);
        return { status: 'skipped', message: 'Skipped Drive Upload for Other Division HQ.' };
    }

    const spmFile = document.getElementById('spmFile').files[0];
    if (!spmFile) {
        throw new Error("SPM file is not selected.");
    }

    // --- 3. PREPARE FORM DATA (महत्वपूर्ण सुधार) ---
    // हम JSON नहीं, बल्कि FormData यूज़ करेंगे जो फाइल भेजने का सही तरीका है
    const formData = new FormData();
    
    formData.append('file', spmFile); // File attach ki
    formData.append('hq', currentHq);
    formData.append('section', document.getElementById('section').value);
    formData.append('trainNo', document.getElementById('trainNumber').value);
    formData.append('lpName', document.getElementById('lpName').value);
    
    // --- 4. UPLOAD TO DRIVE ---
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Google Script ke liye zaroori
            body: formData   // Direct FormData bhej rahe hain
        });
        
        return { status: 'success', message: 'File uploaded to Google Drive successfully.' };
    } catch (error) {
        console.error("Upload Error:", error);
        throw error;
    }
}
