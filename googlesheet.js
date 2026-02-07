async function sendDataToGoogleSheet(data) {
    // 1. Primary Apps Script URL (Main Sheet - SPM ANALYSIS BANK)
    const primaryAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec';

    // 2. Secondary Apps Script URL (Other Sheet - OTHER DIVISION)
    const otherAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec'; 

    // --- ALLOWED HQ LIST ---
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ', 'MXA', 'BYL', 'BXA', 'AAGH', 'PPYD'];

    console.log("Preparing data for submission...");

    // --- START: DATA COLLECTION & MAPPING FIX (CORRECTED) ---

    // 1. Helper function to extract value from Arrays safely (Bug Fixed)
    const getVal = (arr, label) => {
        if (!arr || !Array.isArray(arr)) return '';
        
        // Find the item that matches the label
        const item = arr.find(d => {
            // Case 1: Item is an object (e.g., Train Details)
            if (typeof d === 'object' && d !== null && d.label) {
                return d.label === label;
            }
            // Case 2: Item is a string (e.g., LP Details "LP ID: 1234")
            if (typeof d === 'string') {
                return d.includes(label);
            }
            return false;
        });

        if (!item) return '';

        // Extract value based on type
        if (typeof item === 'object') {
            return item.value || '';
        } else if (typeof item === 'string') {
            return item.split(':')[1]?.trim() || '';
        }
        return '';
    };

    // 2. Map Array Data to Flat Variables (For Sheet1)
    // Train Details Array se nikalein
    data.trainNo = getVal(data.trainDetails, 'Train Number');
    data.locoNo = getVal(data.trainDetails, 'Loco Number');
    
    // Route se From/To nikalne ka logic
    const route = getVal(data.trainDetails, 'Route');
    if (route && route.includes('-')) {
        data.fromStn = route.split('-')[0].trim();
        data.toStn = route.split('-')[1].trim();
    } else {
        data.fromStn = '';
        data.toStn = '';
    }

    data.rakeType = getVal(data.trainDetails, 'Type of Rake');
    data.mps = getVal(data.trainDetails, 'Max Permissible Speed');
    data.section = getVal(data.trainDetails, 'Section');
    data.cliName = getVal(data.trainDetails, 'Analysis By');

    // Crew Details Array se nikalein
    data.lpId = getVal(data.lpDetails, 'LP ID');
    data.lpName = getVal(data.lpDetails, 'LP Name');
    data.lpGroup = getVal(data.lpDetails, 'Group CLI'); 
    
    data.alpId = getVal(data.alpDetails, 'ALP ID');
    data.alpName = getVal(data.alpDetails, 'ALP Name');
    data.alpGroup = getVal(data.alpDetails, 'Group CLI');

    // Stats
    data.totalDist = data.speedRangeSummary?.totalDistance || '0';
    // Calculate Max/Avg Speed from section summary
    if (data.sectionSpeedSummary && data.sectionSpeedSummary.length > 0) {
        const overall = data.sectionSpeedSummary.find(s => s.section.includes('Overall'));
        data.maxSpeed = overall ? overall.maxSpeed : '0';
        data.avgSpeed = overall ? overall.averageSpeed : '0';
    } else {
        data.maxSpeed = '0';
        data.avgSpeed = '0';
    }

    // --- END MAPPING FIX ---

    // --- CONTINUE DATA COLLECTION ---
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
    
    // Heavy images delete karke payload halka karein
    delete data.speedChartConfig;
    delete data.stopChartConfig;
    delete data.speedChartImage;
    delete data.stopChartImage;

    // --- CRITICAL FIX: READ HQ FROM STORAGE ---
    let storedHq = localStorage.getItem('currentSessionHq');
    
    // Try DOM as backup
    if (!storedHq && document.getElementById('cliHqDisplay')) {
        storedHq = document.getElementById('cliHqDisplay').value;
    }

    let currentHq = storedHq ? storedHq.toString().trim().toUpperCase() : "UNKNOWN";
    data.cliHq = currentHq;

    console.log(`Final HQ for Routing: [${currentHq}]`);

    let targetUrl = primaryAppsScriptUrl;
    if (ALLOWED_HQS.includes(currentHq)) {
        console.log(`MATCH: Sending to PRIMARY Sheet.`);
        targetUrl = primaryAppsScriptUrl;
    } else {
        console.log(`NO MATCH: Sending to OTHER DIVISION Sheet.`);
        targetUrl = otherAppsScriptUrl;
    }

   // --- SEND DATA logic ---
    try {
        await fetch(targetUrl, {
            method: 'POST',
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'data',
                payload: data
            })
        });
        console.log('Data sent successfully to YOUR database.');
    } catch (error) {
        console.error('Error in fetch:', error);
        alert('Network Error. Data could not be saved.');
        // Re-throw so report.html knows it failed
        throw error; 
    }
}
