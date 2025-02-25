# LaTeX Assistant Chrome Extension

A Chrome extension designed to assist with LaTeX editing by providing an AI-powered chat interface integrated into ShareLatex or Overleaf. It offers features like markdown rendering, code snippet highlighting, and PubMed lookups for citations and abstracts.

It does not require to subscribe to any services, but it does require however an access to a LLM (e.g. OpenAI API).

## Features

- **AI-Powered Chat**: Interact with an AI assistant specialized in LaTeX, powered by a configurable OpenAI-compatible API.
- **Markdown Parsing**: Render markdown text with support for headers, bold, italics, links, lists, and code blocks.
- **Code Highlighting**: Syntax highlighting for code blocks using Prism.js (if available in the host page).
- **PubMed Integration**: Fetch BibTeX citations and abstracts from PubMed based on article titles or citation keys.
- **Resizable Chat Panel**: A draggable, resizable chat window that integrates with the page's toolbar.
- **Contextual Input**: Use selected text from a CodeMirror editor (e.g., Overleaf) as context for your queries.
- **Clipboard Support**: Copy code snippets directly from the chat with a single click.

## Installation

### Prerequisites

- Google Chrome browser.
- An OpenAI-compatible API key, endpoint, and model (e.g., from OpenAI or a custom server).

### Steps to Install

1. Clone or Download
2. Load the Extension in Chrome
   - Open Chrome and navigate to chrome://extensions/.
   - Enable "Developer mode" in the top right corner.
   - Click "Load unpacked" and select the latex-assistant-extension folder.
3. Configure API Settings
   - Set your API key, endpoint, and model using Chrome's storage API.

## Usage

1. Open a Compatible Page

   - Visit a webpage with a ShareLatex editor (e.g., Overleaf) or adjust the 

     manifest.json matches  field to target specific domains

2. Access the Chat

   - The extension automatically detects a ShareLatex editor and toolbar. A "LaTeX Assistant" button will appear in the toolbar (if present).
   - Click the button to toggle the chat panel.

3. Interact with the Assistant

   - Type a LaTeX-related question in the input box and press "Send" or Enter.
   - Select text in the editor, then focus the input box to use it as context. Press "Send" without typing to query about the selection.

4. PubMed Lookups

   - Ask for a citation (e.g., "Get PubMed citation for 'A Study on X'") or an abstract (e.g., "Fetch abstract for smith2020").
   - The assistant will fetch and display results in LaTeX-friendly format.

5. Manage the Chat

   - Resize the panel by dragging the left edge.
   - Clear the chat history with the trash icon.
   - Copy code snippets using the "Copy" buttons in code blocks.

## Contributing

Feel free to fork this repository, submit issues, or create pull requests. Suggestions for new features or bug fixes are welcome!



Disclaimer: this code was mainly AI generated as a fun experiment with LLMs, however still turned out to be a quite useful tool for anybody using Overleaf, or hosting ShareLatex. 