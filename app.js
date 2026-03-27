```javascript
// --- CONFIGURATION & CONSTANTS ---
const SOURCES = {
    html_marxists: {
        type: 'html',
        baseUrl: 'https://www.marxists.org/archive/marx/works/1867-c1/',
        chapters: Array.from({length: 33}, (_, i) => `ch${String(i + 1).padStart(2, '0')}.htm`),
        citationTemplate: "(Marx, 1867, Chapter {chapter})",
        fullCitation: "Marx, K. (1867). <i>Capital: A Critique of Political Economy, Volume I</i>. Moscow: Progress Publishers.",
        link: "https://www.marxists.org/archive/marx/works/1867-c1/"
    },
    pdf_untermann: {
        type: 'pdf',
        url: 'https://www.marxists.org/archive/marx/works/1867-c1/untermann/volume-1.pdf',
        citationTemplate: "(Marx, 1867/Untermann, p. {page})",
        fullCitation: "Marx, K. (1906). <i>Capital: A Critique of Political Economy, Vol. I</i>. (E. Untermann, Trans.). Chicago: Charles H. Kerr & Company.",
        link: "https://www.marxists.org/archive/marx/works/1867-c1/untermann/volume-1.pdf"
    },
    pdf_penguin: {
        type: 'pdf',
        url: 'https://www.surplusvalue.org.au/Marxism/Capital%20-%20Vol.%201%20Penguin.pdf',
        citationTemplate: "(Marx, 1867/1976, p. {page})",
        fullCitation: "Marx, K. (1976). <i>Capital: A Critique of Political Economy, Volume 1</i> (B. Fowkes, Trans.). Penguin Books.",
        link: "https://www.surplusvalue.org.au/Marxism/Capital%20-%20Vol.%201%20Penguin.pdf"
    }
};

const defaultKeywords = `\\b(africa|egypt|black|slaves?|us south|plantations?|primitive accumulation|colon(?:ial|ies)|cotton|sugar|aboriginal|indigenous|chattel|civil war|pedestal|expropriations?|extirpation|plunder|west indies|east indies|emancipation|virginia|ireland)\\b`;

let currentExtractionData = {}; // Global store for downloaded data
let activeSourceRef = null;
let ui = {};

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
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

    ui.keywordInput.value = defaultKeywords;

    // --- EVENT LISTENERS ---
    ui.extractBtn.addEventListener('click', startExtraction);
    ui.downloadBtn.addEventListener('click', generateAndDownloadMarkdown);
});

function updateStatus(text, state = 'idle') {
    ui.statusText.textContent = text;
    ui.statusIndicator.className = 'w-2.5 h-2.5 rounded-full';
    
    if (state === 'idle') ui.statusIndicator.classList.add('bg-slate-300');
    else if (state === 'running') ui.statusIndicator.classList.add('bg-indigo-500', 'animate-pulse');
    else if (state === 'success') ui.statusIndicator.classList.add('bg-emerald-500');
    else if (state === 'error') ui.statusIndicator.classList.add('bg-red-500');
}

// --- CORE LOGIC ---
async function startExtraction() {
    const rawKeywords = ui.keywordInput.value.trim();
    if (!rawKeywords) {
        alert("Please enter target keywords.");
        return;
    }

    const sourceKey = ui.sourceSelect.value;
    const source = SOURCES[sourceKey];
    activeSourceRef = source;
    
    let keywordPattern;
    try {
        keywordPattern = new RegExp(rawKeywords, 'ig');
    } catch (e) {
        alert("Invalid Regular Expression in keywords.");
        return;
    }

    // Reset UI
    ui.extractBtn.disabled = true;
    ui.downloadBtn.disabled = true;
    ui.resultsContainer.innerHTML = '';
    ui.matchCount.textContent = '0 matches';
    ui.matchCount.classList.add('hidden');
    ui.progressContainer.classList.remove('hidden');
    ui.citationBanner.classList.remove('hidden');
    
    // Populate Citation Header
    ui.activeCitationText.innerHTML = source.fullCitation;
    ui.activeCitationLink.href = source.link;
    
    ui.progressBar.style.width = '0%';
    currentExtractionData = {};
    
    updateStatus('Initializing job...', 'running');

    try {
        if (source.type === 'html') {
            await extractFromHTML(source, keywordPattern);
        } else if (source.type === 'pdf') {
            await extractFromPDF(source, keywordPattern);
        }
        renderResults();
        updateStatus('Extraction complete', 'success');
    } catch (error) {
        console.error(error);
        updateStatus(`Error: ${error.message}`, 'error');
        ui.resultsContainer.innerHTML = `
            <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-medium text-red-800">Job Execution Failed</h3>
                        <div class="mt-2 text-sm text-red-700">
                            <p>Extraction failed. This is likely due to CORS restrictions or proxy rate-limits. Please check the developer console for detailed logs.</p>
                        </div>
                    </div>
                </div>
            </div>`;
    } finally {
        ui.extractBtn.disabled = false;
        ui.progressContainer.classList.add('hidden');
        if (Object.keys(currentExtractionData).length > 0) {
            ui.downloadBtn.disabled = false;
        }
    }
}

// --- HTML EXTRACTION ---
async function extractFromHTML(source, regex) {
    const total = source.chapters.length;
    
    for (let i = 0; i < total; i++) {
        const chapterFile = source.chapters[i];
        const chapterNum = i + 1;
        const targetUrl = source.baseUrl + chapterFile;
        
        updateStatus(`Fetching Chapter ${chapterNum}/${total}`, 'running');
        ui.progressBar.style.width = `${((i) / total) * 100}%`;

        try {
            // Using allorigins as a CORS proxy for HTML
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            if (data.contents) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.contents, "text/html");
                
                // Clean text: remove scripts, styles
                doc.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());
                const text = doc.body.innerText || doc.body.textContent;
                
                const matches = processTextForMatches(text, regex, chapterNum, source.citationTemplate.replace('{chapter}', chapterNum));
                
                if (matches.length > 0) {
                    currentExtractionData[`Chapter ${chapterNum}`] = matches;
                }
            }
        } catch (err) {
            console.warn(`Failed to fetch ${chapterFile}: ${err.message}`);
            // Continue to next chapter even if one fails
        }
        
        // Yield to main thread to keep UI responsive
        await new Promise(r => setTimeout(r, 50));
    }
    ui.progressBar.style.width = `100%`;
}

// --- PDF EXTRACTION ---
async function extractFromPDF(source, regex) {
    updateStatus('Loading binary stream...', 'running');
    
    // corsproxy.io is better for binary streams than allorigins
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(source.url)}`;
    
    const loadingTask = pdfjsLib.getDocument(proxyUrl);
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        if (pageNum % 5 === 0) {
            updateStatus(`Processing page ${pageNum}/${totalPages}`, 'running');
            ui.progressBar.style.width = `${(pageNum / totalPages) * 100}%`;
        }

        try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Basic text assembly
            const pageText = textContent.items.map(item => item.str).join(' ');
            const cleanText = pageText.replace(/-\s+/g, '').replace(/\s+/g, ' ').trim();

            const displayPage = pageNum; // Fallback display page
            const citation = source.citationTemplate.replace('{page}', displayPage);
            
            const matches = processTextForMatches(cleanText, regex, displayPage, citation);
            
            if (matches.length > 0) {
                const key = `Page ${pageNum}`;
                if(!currentExtractionData[key]) currentExtractionData[key] = [];
                currentExtractionData[key].push(...matches);
            }
        } catch (err) {
            console.warn(`Failed reading page ${pageNum}:`, err);
        }

        // Yield heavily to prevent UI freeze during intense text processing
        if (pageNum % 10 === 0) await new Promise(r => setTimeout(r, 50));
    }
    ui.progressBar.style.width = `100%`;
}

// --- TEXT PROCESSING ---
function processTextForMatches(text, regex, locationRef, citationStr) {
    // Simple sentence tokenizer: Split by . ! ? followed by space, avoiding common abbreviations
    const sentenceRegex = /[^.!?]+[.!?]+(?=\s|$)/g;
    const rawSentences = text.match(sentenceRegex) || [text];
    const sentences = rawSentences.map(s => s.trim()).filter(s => s.length > 0);
    
    const matchIndices = [];
    sentences.forEach((s, index) => {
        regex.lastIndex = 0; // Reset regex state
        if (regex.test(s)) {
            matchIndices.push(index);
        }
    });

    if (matchIndices.length === 0) return [];

    // Merge [i-1, i, i+1] context windows
    const windows = matchIndices.map(i => ({
        start: Math.max(0, i - 1),
        end: Math.min(sentences.length - 1, i + 1)
    }));

    const mergedWindows = [];
    if (windows.length > 0) {
        let current = windows[0];
        for (let i = 1; i < windows.length; i++) {
            const next = windows[i];
            if (next.start <= current.end + 1) {
                current.end = Math.max(current.end, next.end);
            } else {
                mergedWindows.push(current);
                current = next;
            }
        }
        mergedWindows.push(current);
    }

    // Extract text blocks
    return mergedWindows.map(w => {
        const block = sentences.slice(w.start, w.end + 1).join(" ");
        return `"${block}" ${citationStr}`;
    });
}

// --- RENDERING ---
function renderResults() {
    ui.resultsContainer.innerHTML = '';
    let totalMatches = 0;

    const fragment = document.createDocumentFragment();

    for (const [section, quotes] of Object.entries(currentExtractionData)) {
        if (quotes.length === 0) continue;
        
        const sectionHeader = document.createElement('h3');
        sectionHeader.className = "text-base font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-4 mt-8 first:mt-2";
        sectionHeader.textContent = section;
        fragment.appendChild(sectionHeader);

        quotes.forEach(quote => {
            totalMatches++;
            const p = document.createElement('p');
            p.className = "mb-5 text-sm leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm relative pl-5 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-indigo-500 before:rounded-l-lg";
            
            // Highlight keywords in the output
            const rawRegexStr = ui.keywordInput.value.trim();
            try {
                const hlRegex = new RegExp(`\\b(${rawRegexStr})\\b`, 'gi');
                p.innerHTML = quote.replace(hlRegex, '<mark class="bg-indigo-100 text-indigo-900 font-semibold px-1 rounded">$1</mark>');
            } catch(e) {
                p.textContent = quote; // fallback if regex is malformed
            }

            fragment.appendChild(p);
        });
    }

    if (totalMatches === 0) {
        ui.resultsContainer.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                <svg class="w-10 h-10 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <p class="text-sm font-medium">No matches found.</p>
                <p class="text-xs mt-1 text-slate-400">Try adjusting your target keywords or checking the source text.</p>
            </div>`;
        ui.matchCount.classList.add('hidden');
    } else {
        ui.resultsContainer.appendChild(fragment);
        ui.matchCount.textContent = `${totalMatches} match${totalMatches !== 1 ? 'es' : ''}`;
        ui.matchCount.classList.remove('hidden');
    }
}

// --- EXPORT ---
function generateAndDownloadMarkdown() {
    // Strip HTML tags for the text-only markdown citation
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = activeSourceRef ? activeSourceRef.fullCitation : "";
    const masterCitation = tempDiv.textContent || tempDiv.innerText || "";
    
    let mdLines = [];
    mdLines.push("# Capital Context Extraction Report\n\n");
    if (masterCitation) {
        mdLines.push(`**Source Document:** ${masterCitation}\n`);
        mdLines.push(`**URL Reference:** ${activeSourceRef.link}\n`);
        mdLines.push(`**Extraction Date:** ${new Date().toISOString().split('T')[0]}\n`);
    }
    mdLines.push("\n---\n\n");

    for (const [section, quotes] of Object.entries(currentExtractionData)) {
        if (quotes.length === 0) continue;
        mdLines.push(`## ${section}\n\n`);
        quotes.forEach(quote => {
            mdLines.push(`> ${quote}\n\n`);
        });
    }

    mdLines.push("---\n\n*Generated via Context Extractor App*");
    
    const blob = new Blob([mdLines.join('')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `extraction_report_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
