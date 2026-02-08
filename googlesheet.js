async function sendDataToGoogleSheet(data) {
    const primaryAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec';
    const otherAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzkE520L99kDeySMkqq7eTz0cmKnf2knMwVzME1OKDEaxcYkbjauRmWaudJvBKIQ76N/exec'; 
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ', 'MXA', 'BYL', 'BXA', 'AAGH', 'PPYD'];

    console.log("Fixing Missing Columns: Train, Loco, From, To...");

    // 1. Precise Value Extractor (Matches RTIS.js labels exactly)
    const getVal = (arr, labelKey) => {
        if (!arr || !Array.isArray(arr)) return '-';
        // RTIS.js के ऑब्जेक्ट स्ट्रक्चर {label: '...', value: '...'} को चेक करें
        const found = arr.find(item => item && item.label && item.label.trim() === labelKey);
        if (found) return String(found.value).trim();

        // अगर पूरा मैच न हो, तो partial match ट्राई करें
        const partial = arr.find(item => item && item.label && item.label.toLowerCase().includes(labelKey.toLowerCase()));
        return partial ? String(partial.value).trim() : '-';
    };

    // --- डेटा मैपिंग (As per RTIS.js) ---

    // A. DateTime (आपका डिफ़ॉल्ट फॉर्मेट जो A और B कॉलम भरता है)
    const currentDateTime = new Date().toLocaleString('en-GB');

    // B. Missing Data Extraction (RTIS.js के सही लेबल्स का उपयोग)
    let locoNo = getVal(data.trainDetails, 'Loco Number');  // RTIS.js में 'Loco Number' है
    let trainNo = getVal(data.trainDetails, 'Train Number'); // RTIS.js में 'Train Number' है
    let rakeType = getVal(data.trainDetails, 'Type of Rake');
    let mps = getVal(data.trainDetails, 'Max Permissible Speed');
    let section = getVal(data.trainDetails, 'Section');
    let cliName = getVal(data.trainDetails, 'Analysis By') || data.cliName || '-';

    // C. From/To Station Logic
    let fromStn = '-';
    let toStn = '-';
    // पहले Station Timings (Page 7) से कोशिश करें
    if (data.stationStops && data.stationStops.length > 0) {
        fromStn = data.stationStops[0].station || '-';
        toStn = data.stationStops[data.stationStops.length - 1].station || '-';
    } else {
        // अगर वहां नहीं है, तो 'Route' लेबल (जैसे "DURG-BSP") को तोड़ें
        const routeVal = getVal(data.trainDetails, 'Route');
        if (routeVal && routeVal.includes('-')) {
            const parts = routeVal.split('-');
            fromStn = parts[0].trim();
            toStn = parts[1].trim();
        }
    }

    // D. Journey Date (Analysis Time से तारीख निकालना)
    let journeyDate = '-';
    const analysisTime = getVal(data.trainDetails, 'Analysis Time');
    const dateMatch = analysisTime.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
    if (dateMatch) journeyDate = dateMatch[0];

    // E. Crew Data Cleaning (Headers हटाना)
    const cleanCrew = (arr, key) => {
        if (!arr) return '-';
        const str = arr.find(s => typeof s === 'string' && s.toLowerCase().includes(key.toLowerCase()));
        return str && str.includes(':') ? str.split(':')[1].trim() : (str ? str.trim() : '-');
    };

    let lpId = cleanCrew(data.lpDetails, 'LP ID');
    let lpName = cleanCrew(data.lpDetails, 'LP Name');
    let lpGroup = cleanCrew(data.lpDetails, 'Group');
    let alpId = cleanCrew(data.alpDetails, 'ALP ID');
    let alpName = cleanCrew(data.alpDetails, 'ALP Name');
    let alpGroup = cleanCrew(data.alpDetails, 'Group');

    // --- पेलोड तैयार करना (Strict Order) ---
    const payload = {
        dateTime: currentDateTime, 
        cliName: cliName,
        journeyDate: journeyDate,
        trainNo: trainNo,   // अब यह खाली नहीं आएगा
        locoNo: locoNo,     // अब यह खाली नहीं आएगा
        fromStn: fromStn,   // अब यह खाली नहीं आएगा
        toStn: toStn,       // अब यह खाली नहीं आएगा
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
        avgSpeed: (data.sectionSpeedSummary && data.sectionSpeedSummary.length > 0) ? (data.sectionSpeedSummary.find(s => s.section.includes('Overall')) || data.sectionSpeedSummary[0]).averageSpeed : '0',
        maxSpeed: (data.sectionSpeedSummary && data.sectionSpeedSummary.length > 0) ? (data.sectionSpeedSummary.find(s => s.section.includes('Overall')) || data.sectionSpeedSummary[0]).maxSpeed : '0',
        cliObs: document.getElementById('cliRemarks')?.value.trim() || 'NIL',
        actionTaken: document.querySelector('input[name="actionTakenRadio"]:checked')?.value || 'NIL',
        uniqueId: `${lpId}_${trainNo}_${journeyDate.replace(/\//g, '-')}`,
        abnormalityText: document.getElementById('cliAbnormalities')?.value || 'NIL',
        cliHq: localStorage.getItem('currentSessionHq') || 'UNKNOWN'
    };

    // --- SENDING ---
    let storedHq = localStorage.getItem('currentSessionHq') || (document.getElementById('cliHqDisplay') ? document.getElementById('cliHqDisplay').value : "UNKNOWN");
    let targetUrl = ALLOWED_HQS.includes(storedHq.toUpperCase()) ? primaryAppsScriptUrl : otherAppsScriptUrl;

    try {
        await fetch(targetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'data', payload: payload })
        });
        console.log('Data sent successfully.');
    } catch (error) {
        console.error('Submission Error:', error);
        alert('Data could not be saved to Sheet.');
        throw error;
    }
}

// बाकी इवेंट लिसनर वाला हिस्सा सेम रहेगा...
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

