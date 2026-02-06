// googleApiHandler.js - Final Version

// ⚠️ PASTE YOUR NEW DEPLOYMENT URL HERE
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxj8eo_eB4KVwbEhBbL5yJamRemLDUbz_bcxTOliSEID9in1whdu0lA6yNCsFcidhKk/exec';

// Base64 Converter Helper
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const encoded = reader.result.toString().replace(/^data:(.*,)?/, '');
            if ((encoded.length % 4) > 0) { encoded += '='.repeat(4 - (encoded.length % 4)); }
            resolve(encoded);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

async function uploadDataAndFileToGoogle() {
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ'];
    const currentHq = document.getElementById('cliHqDisplay') ? document.getElementById('cliHqDisplay').value.trim().toUpperCase() : '';

    if (!ALLOWED_HQS.includes(currentHq)) {
        console.log(`Skipping Upload for HQ: ${currentHq}`);
        return { status: 'skipped', message: 'Skipped Drive Upload.' };
    }

    const spmFile = document.getElementById('spmFile').files[0];
    if (!spmFile) throw new Error("SPM file is not selected.");

    const base64Content = await fileToBase64(spmFile);
    
    // Upload Payload for Backend
    const payload = {
        type: 'upload',
        fileName: spmFile.name,
        mimeType: spmFile.type || 'application/octet-stream',
        fileContent: base64Content,
        hq: currentHq,
        section: document.getElementById('section').value,
        trainNo: document.getElementById('trainNumber').value,
        lpName: document.getElementById('lpName').value
    };

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
