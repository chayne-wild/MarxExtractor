# Marx's Capital Context Extractor

A high-performance, client-side web application designed to perform granular keyword research and contextual extraction across Karl Marx's Capital: A Critique of Political Economy (Volumes I, II, and III).

## Overview

This tool automates the process of identifying specific terms and their surrounding context within the digital archives of Marxists.org. Unlike standard browser search functions, this application tokenizes the text into sentences and assembles "context windows" (adjacent sentences) to preserve the original meaning of the keyword usage.

## Key Features

* Multi-Volume Support: Comprehensive coverage of Volume I (Production), Volume II (Circulation), and Volume III (Production as a Whole).

* Incremental Rendering: Results are streamed to the UI in real-time as each chapter is processed, allowing for immediate analysis during long-running extraction jobs.

* Advanced Regex Support: Utilizes JavaScript's Regular Expression engine for complex queries, including word boundaries (\b), optional characters, and logical OR operations.

* Context Preservation: Automatically identifies match indices and merges overlapping windows to provide a continuous reading experience for adjacent matches.

* Academic Citation Engine: Dynamically generates academic citations for every extracted quote, mapping file metadata to specific chapters and volumes.

* Markdown Export: Facilitates research workflows by allowing users to download a formatted extraction report containing all quotes, citations, and source links.

## Technical Architecture

The application is built as a serverless, static web tool optimized for GitHub Pages.

* Data Acquisition: Utilizes the allorigins.win public CORS proxy to fetch raw HTML manuscripts from marxists.org directly within the user's browser.

* Parsing Engine: Implements a client-side DOMParser to sanitize incoming HTML, removing navigation menus, footers, and metadata before text extraction.

* Tokenization: Employs a regex-based sentence tokenizer to handle punctuation-aware text splitting, facilitating the creation of [i-1, i, i+1] context windows.

* UI Framework: Integrated with a modern enterprise-grade layout using Tailwind CSS, featuring real-time job status indicators and progress tracking.

## Source Materials

The extractor targets the following Progress Publishers editions:

* Volume I: Samuel Moore and Edward Aveling translation (1887).

* Volume II: I. Lasker translation (1956).

* Volume III: Institute of Marxism-Leninism (1959).

## Operational Limitations

* Proxy Dependency: Job stability is dependent on the availability of the public CORS proxy. High-frequency requests across all volumes may trigger temporary rate-limiting (HTTP 429).

* Client-Side Processing: Large volumes (particularly Volume III with 52 chapters) are processed entirely in memory. Performance may vary based on hardware and browser resource allocation.

* Network Latency: Total extraction time is a function of the target server's response time and the number of chapters selected.

## Deployment

To host this tool, upload index.html, app.js, and style.css to a GitHub repository and enable GitHub Pages under the repository settings.
