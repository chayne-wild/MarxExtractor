/**
 * Marx's Capital Context Extractor - App Logic
 */

const SOURCES = {
    html_marxists_v1: {
        type: 'html',
        name: 'Vol. I',
        baseUrl: 'https://www.marxists.org/archive/marx/works/1867-c1/',
        chapters: Array.from({length: 33}, (_, i) => `ch${String(i + 1).padStart(2, '0')}.htm`),
        citationTemplate: "(Marx, 1867, Vol. I, Ch. {chapter})",
        fullCitation: "Marx, K. (1867). <i>Capital, Volume I</i>. Moscow: Progress Publishers.",
        link: "https://www.marxists.org/archive/marx/works/1867-c1/"
    },
    html_marxists_v2: {
        type: 'html',
        name: 'Vol. II',
        baseUrl: 'https://www.marxists.org/archive/marx/works/1885-c2/',
        chapters: Array.from({length: 19}, (_, i) => `ch${String(i + 1).padStart(2, '0')}.htm`).concat(['ch20_01.htm', 'ch20_02.htm', 'ch20_03.htm', 'ch20_04.htm', 'ch21_01.htm', 'ch21_02.htm']),
        citationTemplate: "(Marx, 1885, Vol. II, Ch. {chapter})",
        fullCitation: "Marx, K. (1885). <i>Capital, Volume II</i>. Moscow: Progress Publishers.",
        link: "https://www.marxists.org/archive/marx/works/1885-c2/"
    },
    html_marxists_v3: {
        type: 'html',
        name: 'Vol. III',
        baseUrl: 'https://www.marxists.org/archive/marx/works/1894-c3/',
        chapters: Array.from({length: 52}, (_, i) => `ch${String(i + 1).padStart(2, '0')}.htm`),
        citationTemplate: "(Marx, 1894, Vol. III, Ch. {chapter})",
        fullCitation: "Marx, K. (1894). <i>Capital, Volume III</i>. Moscow: Progress Publishers.",
        link: "https://www.marxists.org/archive/marx/works/1894-c3/"
    },
    html_marxists_all: {
        type: 'collection',
        sources: ['html_marxists_v1', 'html_marxists_v2', 'html_marxists_v3'],
        fullCitation: "Marx, K. (1867-1894). <i>Capital, Volumes I-III</i>. Moscow: Progress Publishers.",
        link: "https://www.marxists.org/archive/marx/works/"
    }
};

const defaultKeywords = `\\b(africa|egypt|black|slaves?|us south|plantations?|primitive accumulation|colon(?:ial|ies)|cotton|sugar|aboriginal|indigenous|chattel|civil war|pedestal|expropriations?|extirpation|plunder|west indies|east indies|emancipation|virginia|ireland)\\b`;

let currentExtractionData = {};
let activeSourceRef = null;
let ui = {};
let totalMatchCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    ui = {
        keywordInput: document.getElementById('keywordInput'),
        sourceSelect: document.getElementById('sourceSelect'),
        extractBtn: document.getElementById('extractBtn'),
        downloadBtn: document.getElementById('downloadBtn'),
        statusText: document.getElementById('statusText'),
        statusIndicator: document.getElementById('statusIndicator'),
        progressBar: document.getElementById('progressBar'),
        progressContainer: document.getElementById('progressContainer'),
        resultsContainer: document.getElementById('resultsContainer'),
        matchCount: document.getElementById('matchCount'),
        citationBanner: document.getElementById('citationBanner'),
        activeCitationText: document.getElementById('activeCitationText'),
        activeCitationLink: document.getElementById('activeCitationLink')
    };

    if (ui.keywordInput) ui.keywordInput.value = defaultKeywords;
    if (ui.extractBtn) ui.extractBtn.addEventListener('click', startExtraction);
    if (ui.downloadBtn) ui.downloadBtn.addEventListener('click', generateAndDownloadMarkdown);
});

function updateStatus(text, state = 'idle') {
    if (!ui.statusText) return;
    ui.statusText.textContent = text;
    ui.statusIndicator.className = 'w-2.5 h-2.5 rounded-full';
    if (state === 'idle') ui.statusIndicator.classList.add('bg-slate-300');
    else if (state === 'running') ui.statusIndicator.classList.add('bg-indigo-500', 'animate-pulse');
    else if (state === 'success') ui.statusIndicator.classList.add('bg-emerald-500');
    else if (state === 'error') ui.statusIndicator.classList.add('bg-red-500');
}

async function startExtraction() {
    const rawKeywords = ui.keywordInput.value.trim();
    if (!rawKeywords) return alert("Please enter keywords.");

    const sourceKey = ui.sourceSelect.value;
    const source = SOURCES[sourceKey];
    activeSourceRef = source;
    
    let keywordPattern;
    try { 
        keywordPattern = new RegExp(rawKeywords, 'ig'); 
    } catch (e) { 
        return alert("Invalid Regex Pattern."); 
    }

    // Reset UI and State
    ui.extractBtn.disabled = true;
    ui.downloadBtn.disabled = true;
    ui.resultsContainer.innerHTML = ''; // Clear results for new run
    ui.matchCount.classList.add('hidden');
    ui.progressContainer.classList.remove('hidden');
    ui.citationBanner.classList.remove('hidden');
    ui.activeCitationText.innerHTML = source.fullCitation;
    ui.activeCitationLink.href = source.link;
    ui.progressBar.style.width = '0%';
    
    currentExtractionData = {};
    totalMatchCount = 0;
    
    updateStatus('Initializing job...', 'running');

    try {
        if (source.type === 'collection') {
            for (const subKey of source.sources) {
                await extractFromHTML(SOURCES[subKey], keywordPattern, SOURCES[subKey].name);
            }
        } else {
            await extractFromHTML(source, keywordPattern, source.name);
        }
        
        if (totalMatchCount === 0) {
            ui.resultsContainer.innerHTML = '<div class="h-full flex items-center justify-center text-slate-400">No matches found for the given keywords.</div>';
        }
        
        updateStatus('Extraction complete', 'success');
    } catch (error) {
        console.error(error);
        updateStatus(`Error: ${error.message}`, 'error');
    } finally {
        ui.extractBtn.disabled = false;
        ui.progressContainer.classList.add('hidden');
        if (totalMatchCount > 0) ui.downloadBtn.disabled = false;
    }
}

async function extractFromHTML(source, regex, volumeName) {
    const total = source.chapters.length;
    for (let i = 0; i < total; i++) {
        const chapterFile = source.chapters[i];
        let chapterDisplay = chapterFile.replace('ch', '').replace('.htm', '').replace('_', '.');
        if (chapterDisplay.startsWith('0')) chapterDisplay = chapterDisplay.substring(1);
        
        const targetUrl = source.baseUrl + chapterFile;
        updateStatus(`Processing ${volumeName} Ch. ${chapterDisplay}`, 'running');
        ui.progressBar.style.width = `${((i) / total) * 100}%`;

        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            if (data.contents) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.contents, "text/html");
                
                // Clean the DOM of nav/footer elements before text extraction
                doc.querySelectorAll('script, style, nav, footer, .footer, .information, .toc, .index').forEach(el => el.remove());
                const text = doc.body.innerText || doc.body.textContent;
                
                const citationStr = source.citationTemplate.replace('{chapter}', chapterDisplay);
                const matches = processTextForMatches(text, regex, chapterDisplay, citationStr);
                
                if (matches.length > 0) {
                    const sectionKey = `${volumeName} - Chapter ${chapterDisplay}`;
                    currentExtractionData[sectionKey] = matches;
                    
                    // INCREMENTAL RENDERING: Append this chapter's matches to UI immediately
                    appendResultToUI(sectionKey, matches);
                }
            }
        } catch (err) { 
            console.warn(`Failed: ${chapterFile}`, err); 
        }
        
        // Brief pause to allow UI thread to breathe
        await new Promise(r => setTimeout(r, 30));
    }
    ui.progressBar.style.width = `100%`;
}

function processTextForMatches(text, regex, locationRef, citationStr) {
    // Basic sentence splitting logic
    const sentenceRegex = /[^.!?]+[.!?]+(?=\s|$)/g;
    const sentences = (text.match(sentenceRegex) || [text]).map(s => s.trim()).filter(s => s.length > 0);
    
    const matchIndices = [];
    sentences.forEach((s, idx) => { 
        regex.lastIndex = 0; 
        if (regex.test(s)) matchIndices.push(idx); 
    });

    if (matchIndices.length === 0) return [];

    // Create context windows [i-1, i, i+1]
    const windows = matchIndices.map(i => ({ 
        start: Math.max(0, i - 1), 
        end: Math.min(sentences.length - 1, i + 1) 
    }));

    // Merge overlapping windows
    const merged = [];
    if (windows.length > 0) {
        let curr = windows[0];
        for (let i = 1; i < windows.length; i++) {
            if (windows[i].start <= curr.end + 1) {
                curr.end = Math.max(curr.end, windows[i].end);
            } else {
                merged.push(curr);
                curr = windows[i];
            }
        }
        merged.push(curr);
    }
    
    // Format windows as quotes
    return merged.map(w => `"${sentences.slice(w.start, w.end + 1).join(" ")}" ${citationStr}`);
}

/**
 * Appends a specific chapter's results to the UI.
 * This is called incrementally as results are found.
 */
function appendResultToUI(section, quotes) {
    const fragment = document.createDocumentFragment();
    
    const h3 = document.createElement('h3');
    h3.className = "text-base font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-4 mt-8 first:mt-2";
    h3.textContent = section;
    fragment.appendChild(h3);

    const keywordStr = ui.keywordInput.value.trim();
    const hlRegex = new RegExp(`\\b(${keywordStr})\\b`, 'gi');

    quotes.forEach(quote => {
        totalMatchCount++;
        const p = document.createElement('p');
        p.className = "mb-5 text-sm leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm relative pl-5 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-indigo-500 before:rounded-l-lg";
        
        // Highlight keywords for the user
        p.innerHTML = quote.replace(hlRegex, '<mark class="bg-indigo-100 text-indigo-900 font-semibold px-1 rounded">$1</mark>');
        fragment.appendChild(p);
    });

    ui.resultsContainer.appendChild(fragment);
    
    // Update match count display
    ui.matchCount.textContent = `${totalMatchCount} matches found`;
    ui.matchCount.classList.remove('hidden');
    ui.downloadBtn.disabled = false;
}

function generateAndDownloadMarkdown() {
    const temp = document.createElement("div"); 
    temp.innerHTML = activeSourceRef.fullCitation;
    const plainCitation = temp.textContent || temp.innerText;
    
    let md = `# Capital Context Report\n\n**Source:** ${plainCitation}\n**Link:** ${activeSourceRef.link}\n\n---\n\n`;
    
    // Sort keys alphabetically/chronologically if needed, currently posts in order found
    for (const [section, quotes] of Object.entries(currentExtractionData)) {
        md += `## ${section}\n\n`;
        quotes.forEach(q => md += `> ${q}\n\n`);
    }
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `capital_report_${Date.now()}.md`; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
