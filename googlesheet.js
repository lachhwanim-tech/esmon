// googlesheet.js - STRICT MODE (Sheet -> PDF)

// ⚠️ PASTE YOUR NEW DEPLOYMENT URL HERE
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzaqAKJ74Brv_OojWNc4PgQbuJCGsICVzj0gX5aVTPN5vebAMXtuqTbDljzG83AXyqn/exec';

async function sendDataToGoogleSheet(data) {
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
    
    // Update Hidden Fields for PDF
    const cliAbnormalitiesArea = document.getElementById('cliAbnormalities');
    if(cliAbnormalitiesArea) cliAbnormalitiesArea.value = data.abnormality;

    data.cliObservation = document.getElementById('cliRemarks')?.value.trim() || 'NIL';
    data.totalAbnormality = document.getElementById('totalAbnormality')?.value.trim() || '0';
    
    const selectedActionRadio = document.querySelector('input[name="actionTakenRadio"]:checked');
    data.actionTaken = selectedActionRadio ? selectedActionRadio.value : 'NIL';

    // Remarks
    data.bftRemark = document.getElementById('bftRemark')?.value.trim() || 'NA';
    data.bptRemark = document.getElementById('bptRemark')?.value.trim() || 'NA';

    // Update Stops with Remarks for DB
    if (data.stops && Array.isArray(data.stops)) {
        data.stops.forEach((stop, index) => {
            const systemAnalysisSelect = document.querySelector(`.system-analysis-dropdown[data-stop-index="${index}"]`);
            stop.finalSystemAnalysis = systemAnalysisSelect ? systemAnalysisSelect.value : stop.brakingTechnique; // Fallback
            // BrakingTechnique property update karein taki DB me sahi jaye
            stop.brakingTechnique = stop.finalSystemAnalysis; 
            
            const cliRemarkInput = document.querySelector(`.cli-remark-input-row[data-stop-index="${index}"]`);
            stop.cliRemark = cliRemarkInput ? cliRemarkInput.value.trim() : 'NIL'; 
        });
    }
    
    // Clean up heavy items (Images/Configs)
    delete data.speedChartConfig;
    delete data.stopChartConfig;
    delete data.speedChartImage;
    delete data.stopChartImage;

    // HQ Logic
    let currentHq = "UNKNOWN";
    const hqField = document.getElementById('cliHqDisplay');
    if (hqField && hqField.value) {
        currentHq = hqField.value.trim().toUpperCase();
    } else {
        currentHq = localStorage.getItem('currentSessionHq') || "UNKNOWN";
    }
    data.cliHq = currentHq;

    // --- WRAPPER PAYLOAD (JSON Format for Code.gs) ---
    const finalPayload = {
        type: 'data',  
        payload: data
    };

    // --- SEND DATA AND WAIT ---
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(finalPayload)
        });
        console.log('Data sent successfully to Sheet.');
        // No return needed, if no error thrown, we assume success
    } catch (error) {
        console.error('Error sending data to Google Sheet:', error);
        throw new Error('Network Error: Data could not be sent to Google Sheet.'); 
    }
}

// --- Event Listener (Strict Logic) ---
document.addEventListener('DOMContentLoaded', () => {
    const downloadButton = document.getElementById('downloadReport');
    const loadingOverlay = document.getElementById('loadingOverlay');

    if (downloadButton) {
        downloadButton.addEventListener('click', async () => { 
            let isValid = true;
            let firstInvalidElement = null;

            // 1. Validation
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

            // UI Updates
            downloadButton.disabled = true;
            downloadButton.textContent = 'Saving to Database...';
            if(loadingOverlay) loadingOverlay.style.display = 'flex';

            // Get Data
            const reportDataString = localStorage.getItem('spmReportData');
            if (!reportDataString) {
                alert('No report data found. Please Analyze again.');
                if(loadingOverlay) loadingOverlay.style.display = 'none';
                downloadButton.disabled = false;
                downloadButton.textContent = 'Download Report';
                return;
            }

            let reportData;
            try {
                 reportData = JSON.parse(reportDataString);
            } catch(e) {
                 alert("Error retrieving data. Refresh page.");
                 if(loadingOverlay) loadingOverlay.style.display = 'none';
                 return;
            }

            // --- STRICT EXECUTION FLOW ---
            try {
                // STEP 1: Send to Google Sheet
                await sendDataToGoogleSheet(reportData);
                
                // STEP 2: Only if Step 1 succeeds, Generate PDF
                downloadButton.textContent = 'Generating PDF...';
                
                if (typeof generatePDF === 'function') {
                    await generatePDF(); 
                    
                    alert('Data Saved & Report Generated Successfully!');
                    
                    // Cleanup & Redirect
                    localStorage.removeItem('spmReportData');
                    localStorage.removeItem('currentSessionHq');
                    window.location.href = 'index.html'; 
                } else {
                    throw new Error('PDF function missing.');
                }

            } catch (error) { 
                console.error("Process Failed:", error);
                alert("FAILED: Data could not be saved to Google Sheet.\nCheck internet or Script URL.\n(PDF generation stopped)");
                
                downloadButton.disabled = false;
                downloadButton.textContent = 'Download Report';
                if(loadingOverlay) loadingOverlay.style.display = 'none';
            }
        }); 
    }
});
