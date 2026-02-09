const fs = require('fs');
const path = require('path');

// Mga folder at files na safe burahin para makatipid sa AI context
const TARGETS = {
    folders: ['dist', 'build', '.vite', 'out'],
    files: ['*.log', '.DS_Store', 'npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*']
};

function clean() {
    console.log("🚀 Starting Master Cleanup for Kingdom Kids...");

    // 1. Linisin ang mga unnecessary folders
    TARGETS.folders.forEach(folder => {
        const folderPath = path.join(__dirname, folder);
        if (fs.existsSync(folderPath)) {
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log(`✅ Deleted folder: ${folder}`);
        }
    });

    // 2. Linisin ang mga unnecessary files sa root
    const rootFiles = fs.readdirSync(__dirname);
    rootFiles.forEach(file => {
        if (TARGETS.files.some(pattern => file.includes(pattern.replace('*', '')))) {
            fs.unlinkSync(path.join(__dirname, file));
            console.log(`🗑️ Removed junk file: ${file}`);
        }
    });

    console.log("✨ Cleanup Complete! Mas \"matalino\" na ang AI context mo ngayon.");
}

// Patakbuhin ang cleanup
clean();