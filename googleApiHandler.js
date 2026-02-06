// googleApiHandler.js - Updated for Sanket 2.0 (New ID & FormData Fix)

// REPLACE WITH YOUR NEW DEPLOYMENT URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxxYhnChVwHi-p7vSegGJjVfsWwFUZcXAyT1l9VqJUgAd4rsZvpEd_nOoZCrgATVvCe/exec';

/**
 * Gathers metadata and the file, and sends them to Google Apps Script
 * using FormData (Multipart) which matches the Code.gs logic.
 */
async function uploadDataAndFileToGoogle() {
    // --- 1. DEFINE ALLOWED HQS ---
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ'];

    // Get Current HQ
    const currentHq = document.getElementById('cliHqDisplay') ? document.getElementById('cliHqDisplay').value.trim().toUpperCase() : '';

    // --- 2. CHECK IF UPLOAD SHOULD BE SKIPPED ---
    if (!ALLOWED_HQS.includes(currentHq)) {
        console.log(`CLI HQ (${currentHq}) is not in the allowed list. Skipping Google Drive Upload.`);
        return { status: 'skipped', message: 'Skipped Drive Upload for Other Division HQ.' };
    }

    // Check for file
    const spmFile = document.getElementById('spmFile').files[0];
    if (!spmFile) {
        throw new Error("SPM file is not selected.");
    }

    // --- 3. PREPARE FORM DATA (MULTIPART) ---
    // Hum JSON use nahi karenge, kyuki Code.gs me 'handleFileUpload'
    // multipart/form-data expect karta hai.
    const formData = new FormData();
    
    // File append karein
    formData.append('file', spmFile);
    
    // Metadata append karein (Logging ke liye)
    formData.append('hq', currentHq);
    formData.append('section', document.getElementById('section').value);
    formData.append('trainNo', document.getElementById('trainNumber').value);
    formData.append('lpName', document.getElementById('lpName').value);
    
    // Destination Folder ID (Optional, Code.gs me default set hai, par bhej sakte hain)
    // formData.append('destinationId', '1n9ihJuA4Q0khKR-n_2YiZfn3a6jg28Gk'); 

    // --- 4. UPLOAD TO DRIVE ---
    await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Google Script ke liye zaroori hai
        body: formData   // Ab hum seedha FormData bhej rahe hain
    });

    return { status: 'success', message: 'File uploaded to Google Drive successfully.' };
}
