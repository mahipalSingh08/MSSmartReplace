<div align="center">
  <h1>MSSmartReplace</h1>
  <p><strong>A smarter Find & Replace for VS Code with deterministic, context-aware undo.</strong></p>
</div>

---

## 🛑 The Problem

VS Code's native "Replace All" is a blind text search. When you replace text across dozens of files, undoing that action usually means running the search in reverse (e.g., replacing "B" back to "A"). 

This is incredibly dangerous. If you wrote new code containing "B" in the meantime, or if "B" already existed elsewhere in your project, the reverse-search will blindly overwrite those instances too, silently corrupting your codebase. 

## 💡 The Solution

**MSSmartReplace** fixes this by recording an **exact manifest** of every replaced string and its surrounding context *before* the edit is applied. When you want to undo a replacement, the extension reads the manifest and performs a precise replay of the transaction—reverting only the exact locations that were originally changed.

If the file has drifted (e.g., you edited the lines surrounding the match), the extension safely skips that location and warns you, preventing accidental code deletion.

## ✨ Features

- **Context-Aware Undo:** Safely undo mass-replacements without fear of corrupting other parts of your code.
- **Drift Detection:** If you modify a file after replacing text, the undo operation detects the drift and prevents unsafe reversions.
- **Activity Bar History:** Browse your complete Smart Replace history in the VS Code Activity Bar.
- **Diff Previews:** Click on any affected file in the history tree to see an exact diff of what was changed.
- **Git Integration:** Automatically stage and commit your mass-replacements as a single, atomic Git commit (optional).
- **Flexible Scope:** Run replacements on the current file, the entire workspace, or using custom glob patterns.

## 🚀 Installation

*Note: This extension is currently in development. You can install it locally by building from source.*

1. Clone the repository:
   ```bash
   git clone https://github.com/mahipalSingh08/MSSmartReplace.git
   cd MSSmartReplace
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the extension:
   ```bash
   npm run compile
   ```
4. Package into a VSIX file (requires `vsce`):
   ```bash
   npx vsce package
   ```
5. Install the generated `.vsix` file in VS Code (`Extensions: Install from VSIX...`).

## 🛠️ Usage

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2. Run **`Smart Replace: Find & Replace All`**.
3. Enter your search text, replacement text, and select your scope.
4. If you ever need to undo, run **`Smart Replace: Undo Operation...`** or use the **Smart Replace** view in the Activity Bar.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
Feel free to check the [issues page](https://github.com/mahipalSingh08/MSSmartReplace/issues).

## 📝 License

This project is [MIT](LICENSE) licensed. Created by [Mahipal Singh](https://mahipal.tech/).
