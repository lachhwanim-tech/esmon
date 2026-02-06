// googleApiHandler.js - REVERTED TO BASE64 (Stable Version)

// Yahan apni 'xx' wali ID dalein (ya agar nayi mili ho to wo)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxY1rk4kWXqueYg7iBWvz1jIlVfmD_F8gtoC8sXm4VMf8Xsq1ghqhj7zXH58NNhMhW0/exec';

// Helper to convert File to Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
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
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ'];
    const currentHq = document.getElementById('cliHqDisplay') ? document.getElementById('cliHqDisplay').value.trim().toUpperCase() : '';

    if (!ALLOWED_HQS.includes(currentHq)) {
        console.log(`Skipping Upload for HQ: ${currentHq}`);
        return { status: 'skipped', message: 'Skipped Drive Upload.' };
    }

    const spmFile = document.getElementById('spmFile').files[0];
    if (!spmFile) throw new Error("SPM file is not selected.");

    // --- PREPARE JSON PAYLOAD (NO FORM DATA) ---
    const base64Content = await fileToBase64(spmFile);
    
    const payload = {
        type: 'upload', // Backend will use this to route to handleFileUploadBase64
        fileName: spmFile.name,
        mimeType: spmFile.type || 'application/octet-stream',
        fileContent: base64Content,
        hq: currentHq,
        section: document.getElementById('section').value,
        trainNo: document.getElementById('trainNumber').value,
        lpName: document.getElementById('lpName').value
    };

    // --- SEND AS JSON ---
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' }, // Avoid CORS preflight
            body: JSON.stringify(payload)
        });
        
        return { status: 'success', message: 'File uploaded successfully.' };
    } catch (error) {
        console.error("Upload Error:", error);
        throw error;
    }
}
