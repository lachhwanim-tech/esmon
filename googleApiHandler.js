// googleApiHandler.js - Base64 Upload Logic

// ⚠️ PASTE YOUR NEW DEPLOYMENT URL HERE
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzaqAKJ74Brv_OojWNc4PgQbuJCGsICVzj0gX5aVTPN5vebAMXtuqTbDljzG83AXyqn/exec';

// Helper: Convert File to Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // "data:application/pdf;base64," wala part hatana hai
            const encoded = reader.result.toString().replace(/^data:(.*,)?/, '');
            if ((encoded.length % 4) > 0) {
                encoded += '='.repeat(4 - (encoded.length % 4));
            }
            resolve(encoded);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

async function uploadDataAndFileToGoogle() {
    // 1. Define Allowed HQs
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ'];
    
    // Get Current HQ
    const currentHq = document.getElementById('cliHqDisplay') ? document.getElementById('cliHqDisplay').value.trim().toUpperCase() : '';

    // 2. Check if upload should be skipped
    if (!ALLOWED_HQS.includes(currentHq)) {
        console.log(`Skipping Upload for HQ: ${currentHq}`);
        return { status: 'skipped', message: 'Skipped Drive Upload.' };
    }

    const spmFile = document.getElementById('spmFile').files[0];
    if (!spmFile) throw new Error("SPM file is not selected.");

    // 3. Convert file to Base64 String
    const base64Content = await fileToBase64(spmFile);
    
    // 4. Create JSON Payload (Matches Code.gs logic)
    const payload = {
        type: 'upload', // Tells Code.gs to use handleFileUploadBase64
        fileName: spmFile.name,
        mimeType: spmFile.type || 'application/octet-stream',
        fileContent: base64Content,
        hq: currentHq,
        section: document.getElementById('section').value,
        trainNo: document.getElementById('trainNumber').value,
        lpName: document.getElementById('lpName').value
    };

    // 5. Send as JSON (using text/plain to avoid CORS preflight)
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' }, 
            body: JSON.stringify(payload)
        });
        
        return { status: 'success', message: 'File uploaded successfully.' };
    } catch (error) {
        console.error("Upload Error:", error);
        throw error;
    }
}
