// googlesheet.js - FINAL (Duplicate Alert + Correct Headers)

// ⚠️ PASTE YOUR NEW DEPLOYMENT URL HERE
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxXT7kVown4wJQ4qhlZBAQTucPowD4MxaVtEwvcscs2uC1LNVs9seTGigA6OmoHRDLZ/exec';

async function sendDataToGoogleSheet(reportData) {
    
    let formData = {};
    try { formData = JSON.parse(localStorage.getItem('spmFormData') || '{}'); } catch(e) {}

    const payload = {
        // Basic
        cliName: formData.cliName || 'Unknown',
        journeyDate: formData.journeyDate || '',
        trainNumber: reportData.trainDetails?.find(d => d.label === 'Train Number')?.value || '',
        locoNumber: formData.locoNumber || reportData.trainDetails?.find(d => d.label === 'Loco Number')?.value || '',
        fromStation: formData.fromStation || '',
        toStation: formData.toStation || '',
        rakeType: reportData.trainDetails?.find(d => d.label === 'Type of Rake')?.value || '',
        mps: formData.mps || '',
        section: reportData.trainDetails?.find(d => d.label === 'Section')?.value || '',

        // Crew (No HQs)
        lpId: reportData.lpDetails?.[0]?.split(':')[1]?.trim() || '',
        lpName: reportData.lpDetails?.[1]?.split(':')[1]?.trim() || '',
        lpGroupCli: formData.lpGroupCli || '',
        alpId: reportData.alpDetails?.[0]?.split(':')[1]?.trim() || '',
        alpName: reportData.alpDetails?.[1]?.split(':')[1]?.trim() || '',
        alpGroupCli: formData.alpGroupCli || '',

        // Metrics (Corrected BPT Logic)
        bftStatus: reportData.bftDetails?.time ? 'Done' : 'Not Done',
        bptStatus: reportData.bptDetails?.time ? 'Done' : 'Not Done',
        overspeedCount: reportData.overSpeedDetails?.length || 0,
        totalDistance: reportData.speedRangeSummary?.totalDistance || '0',
        avgSpeed: reportData.sectionSpeedSummary?.[reportData.sectionSpeedSummary.length-1]?.averageSpeed || '',
        maxSpeed: reportData.sectionSpeedSummary?.[reportData.sectionSpeedSummary.length-1]?.maxSpeed || '',

        // CLI Inputs
        cliObservation: document.getElementById('cliRemarks')?.value.trim() || 'NIL',
        actionTaken: document.querySelector('input[name="actionTakenRadio"]:checked')?.value || 'NIL',
        
        // Flags
        abnormality_bft_nd: document.getElementById('chk-bft-nd')?.checked ? 1 : 0,
        abnormality_bpt_nd: document.getElementById('chk-bpt-nd')?.checked ? 1 : 0,
        abnormality_bft_rule: document.getElementById('chk-bft-rule')?.checked ? 1 : 0,
        abnormality_bpt_rule: document.getElementById('chk-bpt-rule')?.checked ? 1 : 0,
        abnormality_late_ctrl: document.getElementById('chk-late-ctrl')?.checked ? 1 : 0,
        abnormality_overspeed: document.getElementById('chk-overspeed')?.checked ? 1 : 0,
        abnormality_others: document.getElementById('chk-others')?.checked ? 1 : 0,
        totalAbnormality: document.getElementById('totalAbnormality')?.value.trim() || '0',

        stops: []
    };

    // Stops
    if (reportData.stops && Array.isArray(reportData.stops)) {
        payload.stops = reportData.stops.map((stop, index) => {
            const systemAnalysisSelect = document.querySelector(`.system-analysis-dropdown[data-stop-index="${index}"]`);
            const cliRemarkInput = document.querySelector(`.cli-remark-input-row[data-stop-index="${index}"]`);
            return {
                ...stop,
                brakingTechnique: systemAnalysisSelect ? systemAnalysisSelect.value : stop.brakingTechnique,
                cliRemark: cliRemarkInput ? cliRemarkInput.value.trim() : 'NIL'
            };
        });
    }

    const finalPayload = { type: 'data', payload: payload };

    // Standard Fetch to read Duplicate Response
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(finalPayload)
    });

    return await response.json(); 
}

document.addEventListener('DOMContentLoaded', () => {
    const downloadButton = document.getElementById('downloadReport');
    const loadingOverlay = document.getElementById('loadingOverlay');

    if (downloadButton) {
        downloadButton.addEventListener('click', async () => { 
            let isValid = true;
            const actionSelected = document.querySelector('input[name="actionTakenRadio"]:checked');
            if (!actionSelected) { alert('Select Action Taken.'); isValid = false; }
            if (!isValid) return;

            downloadButton.disabled = true;
            downloadButton.textContent = 'Saving...';
            if(loadingOverlay) loadingOverlay.style.display = 'flex';

            const reportDataString = localStorage.getItem('spmReportData');
            if (!reportDataString) return; 
            const reportData = JSON.parse(reportDataString);

            try {
                const result = await sendDataToGoogleSheet(reportData);

                if (result.status === 'duplicate') {
                    // 🛑 STOP
                    if(loadingOverlay) loadingOverlay.style.display = 'none';
                    alert(`⚠️ DUPLICATE ENTRY BLOCKED!\n\nThis trip has already been analyzed by CLI: ${result.existingCli}\n\nData was NOT saved.`);
                    downloadButton.disabled = false;
                    downloadButton.textContent = 'Download Report';
                    return; 
                } 
                else if (result.status === 'success') {
                    // ✅ SUCCESS
                    downloadButton.textContent = 'Generating PDF...';
                    if (typeof generatePDF === 'function') {
                        await generatePDF(); 
                        alert('Data Saved & Report Generated!');
                        localStorage.removeItem('spmReportData');
                        localStorage.removeItem('spmFormData'); 
                        window.location.href = 'index.html'; 
                    }
                } else {
                    throw new Error(result.message || 'Unknown Error');
                }

            } catch (error) { 
                console.error("Save Failed:", error);
                alert("Data saved, but network response was unclear. Please check Sheet.");
                downloadButton.disabled = false;
                downloadButton.textContent = 'Download Report';
                if(loadingOverlay) loadingOverlay.style.display = 'none';
            }
        }); 
    }
});
