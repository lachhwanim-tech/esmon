async function sendDataToGoogleSheet(data) {
    const primaryAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec';
    const otherAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec'; 
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ', 'MXA', 'BYL', 'BXA', 'AAGH', 'PPYD'];

    console.log("Preparing ordered data for submission...");

    // 1. ROBUST GET VALUE FUNCTION
    const getVal = (arr, labels) => {
        if (!arr || !Array.isArray(arr)) return '';
        const searchLabels = Array.isArray(labels) ? labels : [labels];
        
        const item = arr.find(d => {
            if (d === null || d === undefined) return false;
            if (typeof d === 'object' && d.label) {
                return searchLabels.some(l => d.label.toLowerCase().includes(l.toLowerCase()));
            }
            return searchLabels.some(l => String(d).toLowerCase().includes(l.toLowerCase()));
        });

        if (!item) return '';
        if (typeof item === 'object') return item.value || '';
        const strItem = String(item);
        return strItem.includes(':') ? strItem.split(':')[1]?.trim() || '' : strItem;
    };

    // 2. EXTRACTION LOGIC
    // Route Splitter
    let fromStn = '', toStn = '';
    const route = getVal(data.trainDetails, ['Route', 'Section']);
    if (route && route.includes('-')) {
        [fromStn, toStn] = route.split('-').map(s => s.trim());
    }

    // Date Logic
    let jDate = getVal(data.trainDetails, ['Journey Date', 'Date']);
    if (!jDate && data.trainDetails) {
        const dateItem = data.trainDetails.find(d => d.value && (d.value.includes('/') || d.value.includes('-')));
        if(dateItem) jDate = dateItem.value.split(' ')[0];
    }

    // Stats
    let maxSpeed = '0', avgSpeed = '0';
    if (data.sectionSpeedSummary && data.sectionSpeedSummary.length > 0) {
        const overall = data.sectionSpeedSummary.find(s => s.section.includes('Overall')) || data.sectionSpeedSummary[0];
        maxSpeed = overall.maxSpeed || '0';
        avgSpeed = overall.averageSpeed || '0';
    }

    // Abnormalities
    const abn = {
        bft_nd: document.getElementById('chk-bft-nd')?.checked ? 1 : 0,
        bpt_nd: document.getElementById('chk-bpt-nd')?.checked ? 1 : 0,
        bft_rule: document.getElementById('chk-bft-rule')?.checked ? 1 : 0,
        bpt_rule: document.getElementById('chk-bpt-rule')?.checked ? 1 : 0,
        late_ctrl: document.getElementById('chk-late-ctrl')?.checked ? 1 : 0,
        overspeed: document.getElementById('chk-overspeed')?.checked ? 1 : 0,
        others: document.getElementById('chk-others')?.checked ? 1 : 0
    };

    const abnStrings = [];
    if (abn.bft_nd) abnStrings.push("BFT not done");
    if (abn.bpt_nd) abnStrings.push("BPT not done");
    if (abn.bft_rule) abnStrings.push(`BFT not done as per rule:- ${document.getElementById('txt-bft-rule')?.value.trim()}`);
    if (abn.bpt_rule) abnStrings.push(`BPT not done as per rule:- ${document.getElementById('txt-bpt-rule')?.value.trim()}`);
    if (abn.late_ctrl) abnStrings.push(`Late Controlling:- ${document.getElementById('txt-late-ctrl')?.value.trim()}`);
    if (abn.overspeed) abnStrings.push(`Over speeding:- ${document.getElementById('txt-overspeed')?.value.trim()}`);
    if (abn.others) abnStrings.push(`Other Abnormalities:- ${document.getElementById('txt-others')?.value.trim()}`);

    // HQ Logic
    let storedHq = localStorage.getItem('currentSessionHq');
    if (!storedHq && document.getElementById('cliHqDisplay')) storedHq = document.getElementById('cliHqDisplay').value;
    let currentHq = storedHq ? storedHq.toString().trim().toUpperCase() : "UNKNOWN";

    // 3. CONSTRUCT STRICT ORDERED PAYLOAD (Exactly matching Sheet1 Headers)
    // We create a new object to ensure clean data transmission
    const orderedPayload = {
        // --- Sheet1 Columns Mapping ---
        dateTime: new Date().toLocaleString('en-GB'), // Current Timestamp
        cliName: getVal(data.trainDetails, ['Analysis By', 'CLI Name', 'CLI']) || data.cliName || '', // Fallback to manual entry
        journeyDate: jDate,
        trainNo: getVal(data.trainDetails, ['Train No', 'Train Number']),
        locoNo: getVal(data.trainDetails, ['Loco No', 'Loco Number', 'Loco']),
        fromStn: fromStn,
        toStn: toStn,
        rakeType: getVal(data.trainDetails, ['Rake', 'Type']),
        mps: getVal(data.trainDetails, ['MPS', 'Max Speed', 'Permissible']),
        section: getVal(data.trainDetails, ['Section']),
        
        lpId: getVal(data.lpDetails, ['LP ID', 'ID']),
        lpName: getVal(data.lpDetails, ['LP Name', 'Name']),
        lpGroup: getVal(data.lpDetails, ['Group', 'HQ']),
        
        alpId: getVal(data.alpDetails, ['ALP ID', 'ID']),
        alpName: getVal(data.alpDetails, ['ALP Name', 'Name']),
        alpGroup: getVal(data.alpDetails, ['Group', 'HQ']),
        
        bftStatus: document.getElementById('bftRemark')?.value.trim() || 'NA',
        bptStatus: document.getElementById('bptRemark')?.value.trim() || 'NA',
        overspeedCount: data.overSpeedDetails ? data.overSpeedDetails.length : 0,
        totalDist: data.speedRangeSummary?.totalDistance || '0',
        avgSpeed: avgSpeed,
        maxSpeed: maxSpeed,
        
        cliObs: document.getElementById('cliRemarks')?.value.trim() || 'NIL',
        actionTaken: document.querySelector('input[name="actionTakenRadio"]:checked')?.value || 'NIL',
        
        // Abnormality Counts (0/1)
        bftNotDone: abn.bft_nd,
        bptNotDone: abn.bpt_nd,
        bftRule: abn.bft_rule,
        bptRule: abn.bpt_rule,
        lateCtrl: abn.late_ctrl,
        overspeed: abn.overspeed,
        other: abn.others,
        totalAbn: document.getElementById('totalAbnormality')?.value.trim() || '0',
        
        spare: '', // Reserved column
        uniqueId: '', // Script will generate this or we can leave empty
        
        // --- Extra Data for Tab 2 (Detailed Stops) ---
        stops: data.stops, // Array for detailed sheet
        abnormalityText: abnStrings.join('; \n') || 'NIL', // Full text for PDF/Sheet
        cliHq: currentHq
    };

    // Update CLI Abnormalities field for PDF generation before sending
    const cliAbnormalitiesArea = document.getElementById('cliAbnormalities');
    if(cliAbnormalitiesArea) cliAbnormalitiesArea.value = orderedPayload.abnormalityText;

    // Routing
    let targetUrl = ALLOWED_HQS.includes(currentHq) ? primaryAppsScriptUrl : otherAppsScriptUrl;
    console.log(`Routing to: ${targetUrl.includes('other') ? 'Other' : 'Primary'} based on HQ: ${currentHq}`);

    // Send
    try {
        await fetch(targetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'data',
                payload: orderedPayload // Sending the clean, ordered object
            })
        });
        console.log('Data sent successfully.');
    } catch (error) {
        console.error('Error in fetch:', error);
        alert('Network Error. Data could not be saved.');
        throw error;
    }
}

// --- Event Listener (Button Logic) ---
document.addEventListener('DOMContentLoaded', () => {
    const downloadButton = document.getElementById('downloadReport');
    const loadingOverlay = document.getElementById('loadingOverlay');

    if (downloadButton) {
        downloadButton.addEventListener('click', async () => { 
            let isValid = true;
            document.querySelectorAll('#abnormalities-checkbox-container input[type="checkbox"]:checked').forEach(chk => {
                const textId = chk.dataset.textId;
                if (textId) {
                    const textField = document.getElementById(textId);
                    if (!textField || !textField.value.trim()) {
                        alert(`Please enter a remark for the selected abnormality.`);
                        isValid = false;
                    }
                }
            });
            
            if (!document.querySelector('input[name="actionTakenRadio"]:checked')) {
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
                try { reportData = JSON.parse(reportDataString); } 
                catch(e) { 
                    alert("Error retrieving data."); 
                    if(loadingOverlay) loadingOverlay.style.display = 'none';
                    return; 
                }

                try {
                    await sendDataToGoogleSheet(reportData);
                    
                    if (typeof generatePDF === 'function') {
                        await generatePDF(); 
                        alert('Data submitted and report generated. Redirecting...');
                        
                        localStorage.removeItem('spmReportData');
                        localStorage.removeItem('currentSessionHq');
                        localStorage.removeItem('isOtherCliMode');
                        localStorage.removeItem('customCliName');
                        window.location.href = 'index.html'; 
                    } else { alert('PDF function missing.'); }
                } catch (error) { 
                    console.error("Error:", error);
                    alert("Error during submission: " + error.message);
                    downloadButton.disabled = false;
                    downloadButton.textContent = 'Download Report';
                    if(loadingOverlay) loadingOverlay.style.display = 'none';
                }
            } else {
                alert('No report data found.');
                if(loadingOverlay) loadingOverlay.style.display = 'none';
            }
        }); 
    }
});
