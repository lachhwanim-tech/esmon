// googlesheet.js - Final Version

// ⚠️ PASTE YOUR NEW DEPLOYMENT URL HERE
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxj8eo_eB4KVwbEhBbL5yJamRemLDUbz_bcxTOliSEID9in1whdu0lA6yNCsFcidhKk/exec';

async function sendDataToGoogleSheet(data) {
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DRZ', 'DURG'];

    // Collect Checkbox Data
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

    // Remove heavy objects
    delete data.speedChartConfig; delete data.stopChartConfig; delete data.speedChartImage; delete data.stopChartImage;

    // HQ Logic
    let currentHq = "UNKNOWN";
    const hqField = document.getElementById('cliHqDisplay');
    if (hqField && hqField.value) { currentHq = hqField.value.trim().toUpperCase(); }
    else { currentHq = localStorage.getItem('currentSessionHq') || "UNKNOWN"; }
    data.cliHq = currentHq;

    // Payload Wrapper for Backend
    const finalPayload = { type: 'data', payload: data };

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(finalPayload)
        });
        console.log('Data sent successfully.');
    } catch (error) {
        console.error('Error sending data:', error);
        alert('Network Error. Data could not be sent.');
        throw error; 
    }
}
