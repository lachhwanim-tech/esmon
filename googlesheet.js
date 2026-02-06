// googlesheet.js - Updated & Fixed

// ⚠️ यहाँ STEP 1 से मिला नया URL पेस्ट करें
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyKbUTKLME_t5Ccln-GvLaBeOyCXhlwRuRv8V7g2hyO-IVSkYkuOUCAZ0bkAOaQgULx/exec';

async function sendDataToGoogleSheet(data) {
    // --- START: DATA COLLECTION ---
    data.abnormality_bft_nd = document.getElementById('chk-bft-nd')?.checked ? 1 : 0;
    data.abnormality_bpt_nd = document.getElementById('chk-bpt-nd')?.checked ? 1 : 0;
    data.abnormality_bft_rule = document.getElementById('chk-bft-rule')?.checked ? 1 : 0;
    data.abnormality_bpt_rule = document.getElementById('chk-bpt-rule')?.checked ? 1 : 0;
    data.abnormality_late_ctrl = document.getElementById('chk-late-ctrl')?.checked ? 1 : 0;
    data.abnormality_overspeed = document.getElementById('chk-overspeed')?.checked ? 1 : 0;
    data.abnormality_others = document.getElementById('chk-others')?.checked ? 1 : 0;

    const abnormalityStrings = [];
    if (data.abnormality_bft_nd) abnormalityStrings.push("BFT not done");
    if (data.abnormality_bpt_nd) abnormalityStrings.push("BPT not done");
    if (data.abnormality_bft_rule) abnormalityStrings.push(`BFT not done as per rule:- ${document.getElementById('txt-bft-rule')?.value.trim()}`);
    if (data.abnormality_bpt_rule) abnormalityStrings.push(`BPT not done as per rule:- ${document.getElementById('txt-bpt-rule')?.value.trim()}`);
    if (data.abnormality_late_ctrl) abnormalityStrings.push(`Late Controlling:- ${document.getElementById('txt-late-ctrl')?.value.trim()}`);
    if (data.abnormality_overspeed) abnormalityStrings.push(`Over speeding:- ${document.getElementById('txt-overspeed')?.value.trim()}`);
    if (data.abnormality_others) abnormalityStrings.push(`Other Abnormalities:- ${document.getElementById('txt-others')?.value.trim()}`);

    data.abnormality = abnormalityStrings.join('; \n') || 'NIL'; 
    data.cliObservation = document.getElementById('cliRemarks')?.value.trim() || 'NIL';
    data.totalAbnormality = document.getElementById('totalAbnormality')?.value.trim() || '0';
    
    const selectedActionRadio = document.querySelector('input[name="actionTakenRadio"]:checked');
    data.actionTaken = selectedActionRadio ? selectedActionRadio.value : 'NIL';

    // --- Clean up heavy items ---
    delete data.speedChartConfig;
    delete data.stopChartConfig;
    delete data.speedChartImage;
    delete data.stopChartImage;

    // --- HQ Logic (Read directly from form) ---
    let currentHq = "UNKNOWN";
    const hqField = document.getElementById('cliHqDisplay');
    if (hqField && hqField.value) {
        currentHq = hqField.value.trim().toUpperCase();
    } else {
        // Fallback to localStorage if field is not on this page
        currentHq = localStorage.getItem('currentSessionHq') || "UNKNOWN";
    }
    data.cliHq = currentHq;

    // --- PAYLOAD WRAPPING (महत्वपूर्ण सुधार) ---
    // यह Backend को बताएगा कि यह 'data' है, फाइल नहीं
    const finalPayload = {
        type: 'data',  
        payload: data
    };

    // --- SEND DATA ---
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // JSON stringify ke liye safe header
            },
            body: JSON.stringify(finalPayload)
        });

        console.log('Data sent successfully to:', SCRIPT_URL);

    } catch (error) {
        console.error('Error sending data:', error);
        alert('Network Error. Data could not be sent.');
        throw error; 
    }
}
