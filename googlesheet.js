async function sendDataToGoogleSheet(data) {
    const primaryAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec';
    const otherAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec'; 
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ', 'MXA', 'BYL', 'BXA', 'AAGH', 'PPYD'];

    console.log("Preparing Precise Payload...");

    // --- 1. SPECIALIZED HELPER FUNCTIONS (Based on RTIS.js Structure) ---

    // Function A: For "Train Details" (Array of Objects: {label: "...", value: "..."})
    const getPairVal = (arr, keys) => {
        if (!arr || !Array.isArray(arr)) return '';
        const searchKeys = Array.isArray(keys) ? keys : [keys];
        
        // Find object where 'label' contains one of our keys
        const item = arr.find(d => {
            if (!d || !d.label) return false;
            return searchKeys.some(k => d.label.toLowerCase().includes(k.toLowerCase()));
        });

        // Return the 'value' property directly
        if (item && item.value) {
            return String(item.value).replace(/["\n\r]/g, '').trim();
        }
        return '';
    };

    // Function B: For "Crew Details" (Array of Strings: "LP ID: 1234")
    const getStrVal = (arr, keys) => {
        if (!arr || !Array.isArray(arr)) return '';
        const searchKeys = Array.isArray(keys) ? keys : [keys];

        // Find string that contains one of our keys
        const itemStr = arr.find(s => {
            if (typeof s !== 'string') return false;
            return searchKeys.some(k => s.toLowerCase().includes(k.toLowerCase()));
        });

        if (itemStr) {
            // Split by ':' and take the second part
            if (itemStr.includes(':')) {
                return itemStr.split(':')[1].replace(/["\n\r]/g, '').trim();
            }
            return itemStr.replace(/["\n\r]/g, '').trim();
        }
        return '';
    };

    // --- 2. DATA EXTRACTION ---

    // A. Manual Date Formatting (Fixed Format: DD/MM/YYYY HH:MM:SS)
    const now = new Date();
    const pad = (n) => (n < 10 ? '0' + n : n);
    const currentDateTime = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // B. Train Details (Using getPairVal for Objects)
    let trainNo = getPairVal(data.trainDetails, ['Train Number', 'Train No', 'Train']);
    let locoNo = getPairVal(data.trainDetails, ['Loco Number', 'Loco No', 'Loco']);
    let section = getPairVal(data.trainDetails, ['Section']);
    let rakeType = getPairVal(data.trainDetails, ['Type of Rake', 'Rake']);
    let mps = getPairVal(data.trainDetails, ['Max Permissible', 'MPS']);
    let cliName = getPairVal(data.trainDetails, ['Analysis By', 'CLI']) || data.cliName || '';
    
    // Route & Station Logic
    let route = getPairVal(data.trainDetails, ['Route']);
    let fromStn = '';
    let toStn = '';

    // Priority 1: Station List (Page 7 Data)
    if (data.stationStops && Array.isArray(data.stationStops) && data.stationStops.length > 0) {
        fromStn = data.stationStops[0].station || '';
        toStn = data.stationStops[data.stationStops.length - 1].station || '';
    }
    
    // Priority 2: Route Split
    if ((!fromStn || !toStn) && route.includes('-')) {
        const parts = route.split('-');
        if(!fromStn) fromStn = parts[0].trim();
        if(!toStn) toStn = parts[1].trim();
    }

    // C. Journey Date
    // RTIS.js puts Date inside "Analysis Time" e.g., "From 2/7/2026..."
    let journeyDate = getPairVal(data.trainDetails, ['Journey Date', 'Date']);
    if (!journeyDate || journeyDate.length < 6) {
        // Find the Analysis Time value
        const analysisTime = getPairVal(data.trainDetails, ['Analysis Time', 'Time']);
        if (analysisTime) {
            const dateMatch = analysisTime.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
            if (dateMatch) journeyDate = dateMatch[0];
        }
    }
    // Fallback
    if (!journeyDate) journeyDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    // D. Crew Details (Using getStrVal for Strings)
    // This fixes the "Header in Data" issue (e.g. removes "LP ID:")
    let lpId = getStrVal(data.lpDetails, ['LP ID', 'ID']);
    let lpName = getStrVal(data.lpDetails, ['LP Name', 'Name']);
    let lpGroup = getStrVal(data.lpDetails, ['Group', 'HQ']);
    
    let alpId = getStrVal(data.alpDetails, ['ALP ID', 'ID']);
    let alpName = getStrVal(data.alpDetails, ['ALP Name', 'Name']);
    let alpGroup = getStrVal(data.alpDetails, ['Group', 'HQ']);

    // E. Stats & Abnormalities
    let maxSpeed = '0', avgSpeed = '0';
    if (data.sectionSpeedSummary && data.sectionSpeedSummary.length > 0) {
        const overall = data.sectionSpeedSummary.find(s => s.section.includes('Overall')) || data.sectionSpeedSummary[0];
        maxSpeed = overall.maxSpeed || '0';
        avgSpeed = overall.averageSpeed || '0';
    }

    const abn = {
        bft_nd: document.getElementById('chk-bft-nd')?.checked ? 1 : 0,
        bpt_nd: document.getElementById('chk-bpt-nd')?.checked ? 1 : 0,
        bft_rule: document.getElementById('chk-bft-rule')?.checked ? 1 : 0,
        bpt_rule: document.getElementById('chk-bpt-rule')?.checked ? 1 : 0,
        late_ctrl: document.getElementById('chk-late-ctrl')?.checked ? 1 : 0,
        overspeed: document.getElementById('chk-overspeed')?.checked ? 1 : 0,
        others: document.getElementById('chk-others')?.checked ? 1 : 0
    };
    const totalAbn = Object.values(abn).reduce((a, b) => a + b, 0);

    const abnStrings = [];
    if (abn.bft_nd) abnStrings.push("BFT not done");
    if (abn.bpt_nd) abnStrings.push("BPT not done");
    if (abn.bft_rule) abnStrings.push(`BFT Rule: ${document.getElementById('txt-bft-rule')?.value.trim()}`);
    if (abn.bpt_rule) abnStrings.push(`BPT Rule: ${document.getElementById('txt-bpt-rule')?.value.trim()}`);
    if (abn.late_ctrl) abnStrings.push(`Late Ctrl: ${document.getElementById('txt-late-ctrl')?.value.trim()}`);
    if (abn.overspeed) abnStrings.push(`Overspeed: ${document.getElementById('txt-overspeed')?.value.trim()}`);
    if (abn.others) abnStrings.push(`Other: ${document.getElementById('txt-others')?.value.trim()}`);
    const fullAbnormalityText = abnStrings.join('; ') || 'NIL';
    
    const cliAbnormalitiesArea = document.getElementById('cliAbnormalities');
    if(cliAbnormalitiesArea) cliAbnormalitiesArea.value = fullAbnormalityText;

    // F. HQ Routing
    let storedHq = localStorage.getItem('currentSessionHq');
    if (!storedHq && document.getElementById('cliHqDisplay')) storedHq = document.getElementById('cliHqDisplay').value;
    let currentHq = storedHq ? storedHq.toString().trim().toUpperCase() : "UNKNOWN";
    let targetUrl = ALLOWED_HQS.includes(currentHq) ? primaryAppsScriptUrl : otherAppsScriptUrl;

    // --- 3. FINAL PAYLOAD ---
    const payload = {
        dateTime: currentDateTime, // Manual format: 08/02/2026 00:20:02
        cliName: cliName,
        journeyDate: journeyDate,
        trainNo: trainNo,
        locoNo: locoNo,
        fromStn: fromStn,
        toStn: toStn,
        rakeType: rakeType,
        mps: mps,
        section: section, // Now correctly extracted
        
        lpId: lpId,
        lpName: lpName,
        lpGroupCli: lpGroup,
        
        alpId: alpId,
        alpName: alpName,
        alpGroupCli: alpGroup,
        
        bftStatus: data.bftDetails?.time ? "Done" : "Not done",
        bptStatus: data.bptDetails?.time ? "Done" : "Not done",
        overspeedCount: data.overSpeedDetails ? data.overSpeedDetails.length : 0,
        totalDist: data.speedRangeSummary?.totalDistance || '0',
        avgSpeed: avgSpeed,
        maxSpeed: maxSpeed,
        
        cliObs: document.getElementById('cliRemarks')?.value.trim() || 'NIL',
        actionTaken: document.querySelector('input[name="actionTakenRadio"]:checked')?.value || 'NIL',
        
        bftNotDone: abn.bft_nd,
        bptNotDone: abn.bpt_nd,
        bftRule: abn.bft_rule,
        bptRule: abn.bpt_rule,
        lateCtrl: abn.late_ctrl,
        overspeed: abn.overspeed,
        other: abn.others,
        totalAbn: totalAbn,
        
        spare: '', 
        uniqueId: `${lpId}_${trainNo}_${journeyDate.replace(/\//g, '-')}`,
        
        stops: data.stops,
        abnormalityText: fullAbnormalityText,
        cliHq: currentHq
    };

    // --- 4. SEND ---
    try {
        await fetch(targetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'data',
                payload: payload
            })
        });
        console.log('Data sent successfully.');
    } catch (error) {
        console.error('Submission Error:', error);
        alert('Network Error: Data could not be saved to Sheet.');
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
                    console.error("Process Error:", error);
                    alert("Error: " + error.message);
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
