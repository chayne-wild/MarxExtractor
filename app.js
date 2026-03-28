/**
 * Marx's Capital Context Extractor - App Logic
 */

const App = (function() {
    const SOURCES = {
        html_marxists_v1: {
            type: 'html',
            name: 'Vol. I',
            baseUrl: '[https://www.marxists.org/archive/marx/works/1867-c1/](https://www.marxists.org/archive/marx/works/1867-c1/)',
            chapters: Array.from({length: 33}, (_, i) => `ch${String(i + 1).padStart(2, '0')}.htm`),
            citationTemplate: "(Marx, 1867, Vol. I, Ch. {chapter})",
            fullCitation: "Marx, K. (1867). <i>Capital, Volume I</i>. Moscow: Progress Publishers.",
            link: "[https://www.marxists.org/archive/marx/works/1867-c1/](https://www.marxists.org/archive/marx/works/1867-c1/)"
        },
        html_marxists_v2: {
            type: 'html',
            name: 'Vol. II',
            baseUrl: '[https://www.marxists.org/archive/marx/works/1885-c2/](https://www.marxists.org/archive/marx/works/1885-c2/)',
            chapters: Array.from({length: 19}, (_, i) => `ch${String(i + 1).padStart(2, '0')}.htm`).concat(['ch20_01.htm', 'ch20_02.htm', 'ch20_03.htm', 'ch20_04.htm', 'ch21_01.htm', 'ch21_02.htm']),
            citationTemplate: "(Marx, 1885, Vol. II, Ch. {chapter})",
            fullCitation: "Marx, K. (1885). <i>Capital, Volume II</i>. Moscow: Progress Publishers.",
            link: "[https://www.marxists.org/archive/marx/works/1885-c2/](https://www.marxists.org/archive/marx/works/1885-c2/)"
        },
        html_marxists_v3: {
            type: 'html',
            name: 'Vol. III',
            baseUrl: '[https://www.marxists.org/archive/marx/works/1894-c3/](https://www.marxists.org/archive/marx/works/1894-c3/)',
            chapters: Array.from({length: 52}, (_, i) => `ch${String(i + 1).padStart(2, '0')}.htm`),
            citationTemplate: "(Marx, 1894, Vol. III, Ch. {chapter})",
            fullCitation: "Marx, K. (1894). <i>Capital, Volume III</i>. Moscow: Progress Publishers.",
            link: "[https://www.marxists.org/archive/marx/works/1894-c3/](https://www.marxists.org/archive/marx/works/1894-c3/)"
        },
        html_marxists_all: {
            type: 'collection',
            sources: ['html_marxists_v1', 'html_marxists_v2', 'html_marxists_v3'],
            fullCitation: "Marx, K. (1867-1894). <i>Capital, Volumes I-III</i>. Moscow: Progress Publishers.",
            link: "[https://www.marxists.org/archive/marx/works/](https://www.marxists.org/archive/marx/works/)"
        }
    };

    const defaultKeywords = `\\b(africa|egypt|black|slaves?|us south|plantations?|primitive accumulation|colon(?:ial|ies)|cotton|sugar|aboriginal|indigenous|chattel|civil war|pedestal|expropriations?|extirpation|plunder|west indies|east indies|emancipation|virginia|ireland)\\b`;

    let currentExtractionData = {};
    let activeSourceRef = null;
    let ui = {};
    let totalMatchCount = 0;
    let isJobHalted = false;

    function init() {
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
    }

    function updateStatus(text, state = 'idle') {
        if (!ui.statusText) return;
        ui.statusText.textContent = text;
        ui.statusIndicator.className = 'w-2.5 h-2.5 rounded-full';
        if (state === 'idle') ui.statusIndicator.classList.add('bg-slate-300');
        else if (state === 'running') ui.statusIndicator.classList.add('bg-indigo-500', 'animate-pulse');
        else if (state === 'success') ui.statusIndicator.classList.add('bg-emerald-500');
        else if (state === 'error') ui.statusIndicator.classList.add('bg-red-500');
    }

    function appendErrorToUI(contextInfo, errorMsg) {
        const loader = document.getElementById('extraction-loader');
        if (loader) loader.remove();

        const fragment = document.createDocumentFragment();
        const div = document.createElement('div');
        div.className = "mb-5 bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm";
        div.innerHTML = `
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
                </div>
                <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-800">Extraction Error: ${contextInfo}</h3>
                    <div class="mt-2 text-sm text-red-700">
                        <p>${errorMsg}</p>
                    </div>
                </div>
            </div>`;
        fragment.appendChild(div);
        ui.resultsContainer.appendChild(fragment);
    }

    /**
     * Robust fetch wrapper implementing multi-proxy fallbacks to handle strict rate-limiting.
     */
    async function fetchWithProxyFallback(targetUrl) {
        const encodedUrl = encodeURIComponent(targetUrl);
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodedUrl}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}`,
            `https://corsproxy.io/?${encodedUrl}`
        ];

        let lastErrorMsg = "";

        for (const proxy of proxies) {
            try {
                const response = await fetch(proxy);
                if (response.status === 429) {
                    throw new Error("HTTP 429: Proxy rate limit hit.");
                }
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const htmlText = await response.text();
                
                // Validate it's actually Marxists.org content and not a silent proxy error page
                if (htmlText.includes("Karl Marx") || htmlText.includes("Capital") || htmlText.length > 2000) {
                    return htmlText;
                } else {
                    throw new Error("Proxy returned invalid payload format.");
                }
            } catch (err) {
                lastErrorMsg = err.message;
                console.warn(`Proxy failed (${proxy}):`, err.message);
                continue; // Try next proxy
            }
        }
        throw new Error(`All proxies failed. Last error: ${lastErrorMsg}`);
    }

    async function startExtraction() {
        const rawKeywords = ui.keywordInput.value.trim();
        if (!rawKeywords) return alert("Please enter keywords.");

        const sourceKey = ui.sourceSelect.value;
        const source = SOURCES[sourceKey];
        activeSourceRef = source;
        
        let keywordPattern;
        try { keywordPattern = new RegExp(rawKeywords, 'ig'); } 
        catch (e) { return alert("Invalid Regex Pattern."); }

        ui.extractBtn.disabled = true;
        ui.downloadBtn.disabled = true;
        isJobHalted = false;
        
        ui.resultsContainer.innerHTML = `
            <div id="extraction-loader" class="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p class="text-sm font-medium">Extracting and tokenizing data...</p>
            </div>`;
        
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
                    if (isJobHalted) break;
                    await extractFromHTML(SOURCES[subKey], keywordPattern, SOURCES[subKey].name);
                }
            } else {
                await extractFromHTML(source, keywordPattern, source.name);
            }
            
            if (isJobHalted) {
                updateStatus('Job halted due to errors', 'error');
            } else if (totalMatchCount === 0) {
                ui.resultsContainer.innerHTML = '<div class="h-full flex items-center justify-center text-slate-400">No matches found for the given keywords.</div>';
                updateStatus('Extraction complete', 'success');
            } else {
                const loader = document.getElementById('extraction-loader');
                if (loader) loader.remove();
                updateStatus('Extraction complete', 'success');
            }
            
        } catch (error) {
            console.error(error);
            updateStatus(`Job Error`, 'error');
            appendErrorToUI("Job Execution Failed", error.message);
        } finally {
            ui.extractBtn.disabled = false;
            ui.progressContainer.classList.add('hidden');
            if (totalMatchCount > 0) ui.downloadBtn.disabled = false;
        }
    }

    async function extractFromHTML(source, regex, volumeName) {
        const total = source.chapters.length;
        for (let i = 0; i < total; i++) {
            if (isJobHalted) return;

            const chapterFile = source.chapters[i];
            let chapterDisplay = chapterFile.replace('ch', '').replace('.htm', '').replace('_', '.');
            if (chapterDisplay.startsWith('0')) chapterDisplay = chapterDisplay.substring(1);
            
            const targetUrl = source.baseUrl + chapterFile;
            updateStatus(`Processing ${volumeName} Ch. ${chapterDisplay}`, 'running');
            ui.progressBar.style.width = `${((i) / total) * 100}%`;

            try {
                const rawHTML = await fetchWithProxyFallback(targetUrl);
                
                const parser = new DOMParser();
                const doc = parser.parseFromString(rawHTML, "text/html");
                doc.querySelectorAll('script, style, nav, footer, .footer, .information, .toc, .index').forEach(el => el.remove());
                
                // Collapse all newlines and excess spaces to guarantee hyphenated words aren't missed
                const rawText = doc.body.textContent || "";
                const cleanText = rawText.replace(/-\s*\n\s*/g, '').replace(/\s+/g, ' ').trim();
                
                const citationStr = source.citationTemplate.replace('{chapter}', chapterDisplay);
                const matches = processTextForMatches(cleanText, regex, citationStr);
                
                if (matches.length > 0) {
                    const sectionKey = `${volumeName} - Chapter ${chapterDisplay}`;
                    currentExtractionData[sectionKey] = {
                        url: targetUrl,
                        quotes: matches
                    };
                    appendResultToUI(sectionKey, currentExtractionData[sectionKey]);
                }
            } catch (err) { 
                console.warn(`Failed: ${chapterFile}`, err);
                if (err.message.includes('429')) {
                    appendErrorToUI(`${volumeName} - Ch. ${chapterDisplay}`, "Strict rate-limiting hit on all proxies. Job aborted to prevent spamming.");
                    isJobHalted = true;
                    throw err;
                } else {
                    appendErrorToUI(`${volumeName} - Ch. ${chapterDisplay}`, err.message);
                }
            }
            await new Promise(r => setTimeout(r, 600)); // 600ms backoff required to survive multi-volume pulls via free proxies
        }
        ui.progressBar.style.width = `100%`;
    }

    function processTextForMatches(cleanText, regex, citationStr) {
        // Robust split: Avoids lookbehind errors on older browsers, captures sentences reliably
        const sentenceRegex = /[^.!?]+[.!?]+["']?(?=\s|$)/g;
        const sentences = (cleanText.match(sentenceRegex) || [cleanText]).map(s => s.trim()).filter(s => s.length > 0);
        
        const matchIndices = [];
        sentences.forEach((s, idx) => { 
            regex.lastIndex = 0; 
            if (regex.test(s)) matchIndices.push(idx); 
        });

        if (matchIndices.length === 0) return [];

        const windows = matchIndices.map(i => ({ start: Math.max(0, i - 1), end: Math.min(sentences.length - 1, i + 1) }));
        const merged = [];
        if (windows.length > 0) {
            let curr = windows[0];
            for (let i = 1; i < windows.length; i++) {
                if (windows[i].start <= curr.end + 1) curr.end = Math.max(curr.end, windows[i].end);
                else { merged.push(curr); curr = windows[i]; }
            }
            merged.push(curr);
        }
        return merged.map(w => `"${sentences.slice(w.start, w.end + 1).join(" ")}" ${citationStr}`);
    }

    function appendResultToUI(section, data) {
        const loader = document.getElementById('extraction-loader');
        if (loader) loader.remove();

        const fragment = document.createDocumentFragment();
        const h3 = document.createElement('h3');
        h3.className = "text-base font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-4 mt-8 first:mt-2 flex justify-between items-end";
        h3.innerHTML = `<span>${section}</span>`;
        fragment.appendChild(h3);

        const hlRegexStr = ui.keywordInput.value.trim();
        const hlRegex = new RegExp(`\\b(${hlRegexStr})\\b`, 'gi');

        data.quotes.forEach(quote => {
            totalMatchCount++;
            const div = document.createElement('div');
            div.className = "mb-5 bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm relative pl-5 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-indigo-500 before:rounded-l-lg";
            
            const highlightedQuote = quote.replace(hlRegex, '<mark class="bg-indigo-100 text-indigo-900 font-semibold px-1 rounded">$1</mark>');
            
            div.innerHTML = `
                <p class="text-sm leading-relaxed text-slate-700">${highlightedQuote}</p>
                <div class="mt-3 pt-3 border-t border-slate-200/60 flex justify-end">
                    <a href="${data.url}" target="_blank" class="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1">
                        View Chapter Source
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </div>
            `;
            fragment.appendChild(div);
        });

        ui.resultsContainer.appendChild(fragment);
        
        ui.matchCount.textContent = `${totalMatchCount} matches`;
        ui.matchCount.classList.remove('hidden');
        ui.downloadBtn.disabled = false;
    }

    function generateAndDownloadMarkdown() {
        const temp = document.createElement("div"); 
        temp.innerHTML = activeSourceRef.fullCitation;
        const plainCitation = temp.textContent || temp.innerText;
        
        let md = `# Capital Context Extraction Report\n\n**Source:** ${plainCitation}\n**Link:** ${activeSourceRef.link}\n**Extraction Date:** ${new Date().toISOString().split('T')[0]}\n\n---\n\n`;
        
        for (const [section, data] of Object.entries(currentExtractionData)) {
            md += `## ${section}\n`;
            md += `**Chapter Source:** [View on Marxists.org](${data.url})\n\n`;
            data.quotes.forEach(q => md += `> ${q}\n\n`);
        }
        
        md += `---\n\n*Generated via Capital Context Extractor*`;

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

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
