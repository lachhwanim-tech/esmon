async function sendDataToGoogleSheet(data) {
    const primaryAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec';
    const otherAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec'; 
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ', 'MXA', 'BYL', 'BXA', 'AAGH', 'PPYD'];

    console.log("Processing Data for Sheet1...");

    // 1. ROBUST GET VALUE FUNCTION
    const getVal = (arr, labels) => {
        if (!arr || !Array.isArray(arr)) return '';
        const searchLabels = Array.isArray(labels) ? labels : [labels];
        
        const item = arr.find(d => {
            if (!d) return false;
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

    // --- 2. EXTRACT DATA CAREFULLY ---

    // A. From Stn & To Stn (LOGIC CHANGED: Based on Station List)
    let fromStn = '', toStn = '';
    
    // Priority 1: Get from Station Timings (First & Last Row)
    if (data.stationStops && Array.isArray(data.stationStops) && data.stationStops.length > 0) {
        // First Station is FROM
        fromStn = data.stationStops[0].station || '';
        // Last Station is TO
        toStn = data.stationStops[data.stationStops.length - 1].station || '';
    }

    // Priority 2: Fallback to Route splitting ONLY if Station List is missing
    if (!fromStn || !toStn) {
        const route = getVal(data.trainDetails, ['Route', 'Section']);
        if (route && route.includes('-')) {
            const parts = route.split('-');
            if(!fromStn) fromStn = parts[0].trim();
            if(!toStn) toStn = parts[1].trim();
        }
    }

    // B. Train & Loco
    let trainNo = getVal(data.trainDetails, ['Train No', 'Train Number']) || '';
    let locoNo = getVal(data.trainDetails, ['Loco No', 'Loco Number', 'Loco']) || '';

    // C. Journey Date (Critical Fix for RTIS/PDF)
    let journeyDate = getVal(data.trainDetails, ['Journey Date', 'Date']);
    if (!journeyDate) {
        // Scan for date in all train details
        const dateItem = data.trainDetails.find(d => {
            const val = typeof d === 'object' ? d.value : d;
            return val && (val.includes('/') || val.includes('-')) && val.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/);
        });
        
        if (dateItem) {
            const val = typeof dateItem === 'object' ? dateItem.value : dateItem;
            const dateMatch = val.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
            if (dateMatch) journeyDate = dateMatch[0];
        }
    }
    if (!journeyDate) journeyDate = new Date().toLocaleDateString('en-GB');

    // D. Crew
    let lpId = getVal(data.lpDetails, ['LP ID', 'ID']) || '';
    let lpName = getVal(data.lpDetails, ['LP Name', 'Name']) || '';
    let lpGroup = getVal(data.lpDetails, ['Group', 'HQ', 'CLI']) || '';
    
    let alpId = getVal(data.alpDetails, ['ALP ID', 'ID']) || '';
    let alpName = getVal(data.alpDetails, ['ALP Name', 'Name']) || '';
    let alpGroup = getVal(data.alpDetails, ['Group', 'HQ', 'CLI']) || '';

    // E. Abnormalities (Checkbox Logic)
    const abn = {
        bft_nd: document.getElementById('chk-bft-nd')?.checked ? 1 : 0,
        bpt_nd: document.getElementById('chk-bpt-nd')?.checked ? 1 : 0,
        bft_rule: document.getElementById('chk-bft-rule')?.checked ? 1 : 0,
        bpt_rule: document.getElementById('chk-bpt-rule')?.checked ? 1 : 0,
        late_ctrl: document.getElementById('chk-late-ctrl')?.checked ? 1 : 0,
        overspeed: document.getElementById('chk-overspeed')?.checked ? 1 : 0,
        others: document.getElementById('chk-others')?.checked ? 1 : 0
    };

    const totalAbn = abn.bft_nd + abn.bpt_nd + abn.bft_rule + abn.bpt_rule + abn.late_ctrl + abn.overspeed + abn.others;

    const abnStrings = [];
    if (abn.bft_nd) abnStrings.push("BFT not done");
    if (abn.bpt_nd) abnStrings.push("BPT not done");
    if (abn.bft_rule) abnStrings.push(`BFT Rule: ${document.getElementById('txt-bft-rule')?.value.trim()}`);
    if (abn.bpt_rule) abnStrings.push(`BPT Rule: ${document.getElementById('txt-bpt-rule')?.value.trim()}`);
    if (abn.late_ctrl) abnStrings.push(`Late Ctrl: ${document.getElementById('txt-late-ctrl')?.value.trim()}`);
    if (abn.overspeed) abnStrings.push(`Overspeed: ${document.getElementById('txt-overspeed')?.value.trim()}`);
    if (abn.others) abnStrings.push(`Other: ${document.getElementById('txt-others')?.value.trim()}`);
    
    const fullAbnormalityText = abnStrings.join('; ') || 'NIL';

    // Update Hidden Field for PDF
    const cliAbnormalitiesArea = document.getElementById('cliAbnormalities');
    if(cliAbnormalitiesArea) cliAbnormalitiesArea.value = fullAbnormalityText;

    // F. Stats
    let maxSpeed = '0', avgSpeed = '0';
    if (data.sectionSpeedSummary && data.sectionSpeedSummary.length > 0) {
        const overall = data.sectionSpeedSummary.find(s => s.section.includes('Overall')) || data.sectionSpeedSummary[0];
        maxSpeed = overall.maxSpeed || '0';
        avgSpeed = overall.averageSpeed || '0';
    }

    // G. Generate Unique ID Locally
    const uniqueTripId = `${lpId}_${trainNo}_${journeyDate.replace(/\//g, '-')}`;

    // --- 3. HQ ROUTING ---
    let storedHq = localStorage.getItem('currentSessionHq');
    if (!storedHq && document.getElementById('cliHqDisplay')) storedHq = document.getElementById('cliHqDisplay').value;
    let currentHq = storedHq ? storedHq.toString().trim().toUpperCase() : "UNKNOWN";
    
    console.log(`Routing HQ: ${currentHq}`);
    let targetUrl = ALLOWED_HQS.includes(currentHq) ? primaryAppsScriptUrl : otherAppsScriptUrl;

    // --- 4. CONSTRUCT FINAL PAYLOAD (Strict Order) ---
    const payload = {
        dateTime: new Date().toLocaleString('en-GB'),
        cliName: getVal(data.trainDetails, ['Analysis By', 'CLI']) || data.cliName || '', 
        journeyDate: journeyDate,
        trainNo: trainNo,
        locoNo: locoNo,
        fromStn: fromStn, // Now comes from First Station
        toStn: toStn,     // Now comes from Last Station
        rakeType: getVal(data.trainDetails, ['Rake', 'Type']),
        mps: getVal(data.trainDetails, ['MPS', 'Max', 'Permissible']),
        section: getVal(data.trainDetails, ['Section']), // This remains NGP-BSP (Fixed Route)
        
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
        
        // Abnormality Flags
        bftNotDone: abn.bft_nd,
        bptNotDone: abn.bpt_nd,
        bftRule: abn.bft_rule,
        bptRule: abn.bpt_rule,
        lateCtrl: abn.late_ctrl,
        overspeed: abn.overspeed,
        other: abn.others,
        totalAbn: totalAbn,
        
        spare: '', 
        uniqueId: uniqueTripId, 
        
        // Extra Data
        stops: data.stops,
        abnormalityText: fullAbnormalityText,
        cliHq: currentHq
    };

    // --- 5. SEND ---
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
