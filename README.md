#Capital Context Extractor

A client-side web application designed to parse and extract keyword-based context windows from various digital editions of Karl Marx's Capital, Volume I.

##Features

Multi-Source Support: Extracts text from both HTML archives and standard PDF translations (Penguin and Untermann editions).

Regex Keyword Matching: Supports complex regular expression queries to find specific terms, boundaries, and variations.

Contextual Windowing: Automatically merges adjacent sentences surrounding a matched keyword to provide readable context.

Markdown Export: Generates a formatted .md file with full academic citations and source links.

Client-Side Processing: All text extraction and parsing occur locally in the browser using pdf.js.

##Repository Structure

index.html: The main user interface and layout.

style.css: Custom styling, typography, and scrollbar definitions.

app.js: Core extraction logic, PDF/HTML parsing, and UI state management.

##Deployment

This application is designed to be hosted statically via GitHub Pages.

Push the repository files (index.html, style.css, app.js) to the main branch.

Navigate to your repository Settings > Pages.

Set the source to deploy from the main branch.

Save and wait for the deployment to finish.

##Technical Architecture & Limitations

Because this tool operates entirely within the browser, it faces specific technical constraints:

CORS Proxies: Browsers block client-side scripts from downloading files from external domains. This app utilizes public CORS proxies (corsproxy.io and api.allorigins.win) to bypass these restrictions.

Rate Limiting: Heavy usage, particularly downloading the large PDF files, may result in temporary rate-limiting (HTTP 429) from the proxy servers. The HTML source is the most reliable and fastest option.

Performance: Evaluating a 1,000-page PDF entirely in browser memory is computationally intensive. The script uses asynchronous yielding to prevent UI freezing, but full extraction may take up to 60 seconds depending on device hardware.
