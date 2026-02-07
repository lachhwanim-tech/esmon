async function sendDataToGoogleSheet(data) {
    const primaryAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec';
    const otherAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec'; 
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ', 'MXA', 'BYL', 'BXA', 'AAGH', 'PPYD'];

    console.log("Preparing Payload with Regex Extraction...");

    // 1. HELPER: CONVERT TRAIN DETAILS TO STRING FOR REGEX SEARCH
    // हम पूरे डेटा को एक लंबी लाइन में बदल देंगे ताकि ढूँढना आसान हो
    const trainDetailsStr = JSON.stringify(data.trainDetails || []);

    // 2. REGEX EXTRACTION FUNCTION
    // यह फंक्शन कचरे (", :, \n) के बीच से सही वैल्यू निकाल लाएगा
    const extractByRegex = (text, patterns) => {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                // वैल्यू मिल गई! अब कोट्स और स्पेस साफ़ करें
                return match[1].replace(/["\\]/g, '').trim();
            }
        }
        return '';
    };

    // --- 3. DATA EXTRACTION (The Fix) ---

    // A. DateTime (Default - This works with your Sheet's extra column)
    const currentDateTime = new Date().toLocaleString('en-GB'); 

    // B. Loco Number (Regex Search)
    // यह "Loco Number","30315" या "Loco Number: 30315" सबको पकड़ लेगा
    let locoNo = extractByRegex(trainDetailsStr, [
        /Loco\s*N(?:umber|o)[\s"':,.-]+([0-9]+)/i,   // Matches: Loco Number","30315
        /Loco[\s"':,.-]+([0-9]+)/i                    // Matches: Loco 30315
    ]);

    // C. Train Number (Regex Search)
    let trainNo = extractByRegex(trainDetailsStr, [
        /Train\s*N(?:umber|o)[\s"':,.-]+([0-9A-Z]+)/i, // Matches: Train Number","18238
        /Train[\s"':,.-]+([0-9A-Z]+)/i
    ]);

    // D. From/To Station Logic
    let fromStn = '';
    let toStn = '';
    let route = '';

    // Step 1: Priority - Check Station List (Page 7)
    if (data.stationStops && Array.isArray(data.stationStops) && data.stationStops.length > 0) {
        fromStn = data.stationStops[0].station || '';
        toStn = data.stationStops[data.stationStops.length - 1].station || '';
    }

    // Step 2: Fallback - Extract "Route" from Page 1 (As per your Hint)
    if (!fromStn || !toStn) {
        // Regex to find "Route","DURG-BSP"
        route = extractByRegex(trainDetailsStr, [
            /Route[\s"':,.-]+([A-Z]+(?:\s*-\s*[A-Z]+))/i,
            /Section[\s"':,.-]+([A-Z]+(?:\s*-\s*[A-Z]+))/i
        ]);

        if (route && route.includes('-')) {
            const parts = route.split('-');
            if(!fromStn) fromStn = parts[0].trim();
            if(!toStn) toStn = parts[1].trim();
        }
    }
    // Section (Route) field
    let section = route || extractByRegex(trainDetailsStr, [/Section[\s"':,.-]+([A-Z]+(?:\s*-\s*[A-Z]+))/i]) || '';


    // E. Extract Other Fields (Standard Method)
    const getVal = (arr, label) => {
        if (!arr) return '';
        const item = arr.find(d => JSON.stringify(d).toLowerCase().includes(label.toLowerCase()));
        if (item) {
             const str = typeof item === 'object' ? item.value : String(item);
             return String(str || '').replace(/["\n\r]/g, '').trim();
        }
        return '';
    };

    let rakeType = getVal(data.trainDetails, 'Rake');
    let mps = getVal(data.trainDetails, 'MPS') || getVal(data.trainDetails, 'Max');
    let journeyDate = getVal(data.trainDetails, 'Date');
    
    // Fix Journey Date if missing
    if (!journeyDate || journeyDate.length < 6) {
        const dateMatch = trainDetailsStr.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
        if (dateMatch) journeyDate = dateMatch[0];
        else journeyDate = new Date().toLocaleDateString('en-GB');
    }

    let lpId = getVal(data.lpDetails, 'ID');
    let lpName = getVal(data.lpDetails, 'Name');
    let lpGroup = getVal(data.lpDetails, 'Group') || getVal(data.lpDetails, 'HQ');
    let alpId = getVal(data.alpDetails, 'ID');
    let alpName = getVal(data.alpDetails, 'Name');
    let alpGroup = getVal(data.alpDetails, 'Group') || getVal(data.alpDetails, 'HQ');

    // F. Abnormalities & Stats
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
    
    // Stats
    let maxSpeed = '0', avgSpeed = '0';
    if (data.sectionSpeedSummary && data.sectionSpeedSummary.length > 0) {
        const overall = data.sectionSpeedSummary.find(s => s.section.includes('Overall')) || data.sectionSpeedSummary[0];
        maxSpeed = overall.maxSpeed || '0';
        avgSpeed = overall.averageSpeed || '0';
    }

    // Set Hidden PDF Fields
    const cliAbnormalitiesArea = document.getElementById('cliAbnormalities');
    if(cliAbnormalitiesArea) cliAbnormalitiesArea.value = fullAbnormalityText;

    // HQ Routing
    let storedHq = localStorage.getItem('currentSessionHq');
    if (!storedHq && document.getElementById('cliHqDisplay')) storedHq = document.getElementById('cliHqDisplay').value;
    let currentHq = storedHq ? storedHq.toString().trim().toUpperCase() : "UNKNOWN";
    let targetUrl = ALLOWED_HQS.includes(currentHq) ? primaryAppsScriptUrl : otherAppsScriptUrl;

    // --- 4. FINAL PAYLOAD ---
    const payload = {
        dateTime: currentDateTime, // Sends "Date, Time" (Needs Col A & B)
        cliName: getVal(data.trainDetails, 'Analysis By') || data.cliName || '',
        journeyDate: journeyDate,
        trainNo: trainNo, // From Regex
        locoNo: locoNo,   // From Regex
        fromStn: fromStn, // From Station List or Route Regex
        toStn: toStn,     // From Station List or Route Regex
        rakeType: rakeType,
        mps: mps,
        section: section,
        
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
