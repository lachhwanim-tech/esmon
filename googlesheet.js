// googlesheet.js - Updated for Sanket 2.0 (New ID & Payload Fix)

// REPLACE WITH YOUR NEW SCRIPT URL HERE
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxxYhnChVwHi-p7vSegGJjVfsWwFUZcXAyT1l9VqJUgAd4rsZvpEd_nOoZCrgATVvCe/exec';

async function sendDataToGoogleSheet(data) {
    // --- ALLOWED HQ LIST ---
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DRZ', 'DURG'];

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
    
    const cliAbnormalitiesArea = document.getElementById('cliAbnormalities');
    if(cliAbnormalitiesArea) cliAbnormalitiesArea.value = data.abnormality;

    data.cliObservation = document.getElementById('cliRemarks')?.value.trim() || 'NIL';
    data.totalAbnormality = document.getElementById('totalAbnormality')?.value.trim() || '0';
    
    const selectedActionRadio = document.querySelector('input[name="actionTakenRadio"]:checked');
    data.actionTaken = selectedActionRadio ? selectedActionRadio.value : 'NIL';

    data.bftRemark = document.getElementById('bftRemark')?.value.trim() || 'NA';
    data.bptRemark = document.getElementById('bptRemark')?.value.trim() || 'NA';

    if (data.stops && Array.isArray(data.stops)) {
        data.stops.forEach((stop, index) => {
            const systemAnalysisSelect = document.querySelector(`.system-analysis-dropdown[data-stop-index="${index}"]`);
            stop.finalSystemAnalysis = systemAnalysisSelect ? systemAnalysisSelect.value : stop.brakingTechnique;
            const cliRemarkInput = document.querySelector(`.cli-remark-input-row[data-stop-index="${index}"]`);
            stop.cliRemark = cliRemarkInput ? cliRemarkInput.value.trim() : 'NIL'; 
        });
    }
    
    // Clean up heavy chart data before sending
    delete data.speedChartConfig;
    delete data.stopChartConfig;
    delete data.speedChartImage;
    delete data.stopChartImage;

    // --- HQ Logic ---
    let storedHq = localStorage.getItem('currentSessionHq');
    if (!storedHq && document.getElementById('cliHqDisplay')) {
        storedHq = document.getElementById('cliHqDisplay').value;
    }
    let currentHq = storedHq ? storedHq.toString().trim().toUpperCase() : "UNKNOWN";
    data.cliHq = currentHq;

    // NOTE: Using SINGLE Script URL now (since we deployed one smart script)
    // If you want logic to split sheets, handle it inside Code.gs, but for now we send to ONE script.
    
    // --- PAYLOAD WRAPPING (CRITICAL FIX) ---
    const finalPayload = {
        type: 'data',  // This tells Code.gs to use handleAnalysisData
        payload: data
    };

    // --- SEND DATA ---
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Important for Google Scripts
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(finalPayload) // Sending wrapped payload
        });

        console.log('Data sent successfully to:', SCRIPT_URL);

    } catch (error) {
        console.error('Error sending data to Google Sheet:', error);
        alert('Network Error. Data could not be sent.');
        throw error; 
    }
}

// --- Event Listener ---
document.addEventListener('DOMContentLoaded', () => {
    const downloadButton = document.getElementById('downloadReport');
    const loadingOverlay = document.getElementById('loadingOverlay');

    if (downloadButton) {
        downloadButton.addEventListener('click', async () => { 
            let isValid = true;
            let firstInvalidElement = null;

            document.querySelectorAll('#abnormalities-checkbox-container input[type="checkbox"]:checked').forEach(chk => {
                const textId = chk.dataset.textId;
                if (textId) {
                    const textField = document.getElementById(textId);
                    if (!textField || !textField.value.trim()) {
                        alert(`Please enter a remark for the selected abnormality.`);
                        if (textField && !firstInvalidElement) firstInvalidElement = textField;
                        isValid = false;
                    }
                }
            });
            
            const actionSelected = document.querySelector('input[name="actionTakenRadio"]:checked');
            if (!actionSelected) {
                 alert('Please select an option for "Action Taken".');
                 isValid = false;
            }

            if (!isValid) return;

            downloadButton.disabled = true;
            downloadButton.textContent = 'Processing...';
            if(loadingOverlay) loadingOverlay.style.display = 'flex';

            const reportDataString = localStorage.getItem('spmReportData');
            if (reportDataString) {
                let reportData;
                try {
                     reportData = JSON.parse(reportDataString);
                } catch(e) {
                     alert("Error retrieving data. Refresh page.");
                     if(loadingOverlay) loadingOverlay.style.display = 'none';
                     return;
                }

                try {
                    // 1. Send Data to Sheet
                    await sendDataToGoogleSheet(reportData);
                    
                    // 2. Generate PDF
                    if (typeof generatePDF === 'function') {
                        await generatePDF(); 
                        alert('Data submitted and report generated. Redirecting...');
                        
                        // 3. Cleanup & Redirect
                        localStorage.removeItem('spmReportData');
                        localStorage.removeItem('currentSessionHq');
                        window.location.href = 'index.html'; 
                    } else {
                        alert('PDF function missing.');
                    }
                } catch (error) { 
                    console.error("Error:", error);
                    alert("Error during submission.");
                    downloadButton.disabled = false;
                    if(loadingOverlay) loadingOverlay.style.display = 'none';
                }
            } else {
                alert('No report data found.');
                if(loadingOverlay) loadingOverlay.style.display = 'none';
            }
        }); 
    }
});
