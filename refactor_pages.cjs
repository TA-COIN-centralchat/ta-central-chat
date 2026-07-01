const fs = require('fs');
const path = require('path');

const directory = 'src/pages';
const exclude = 'LoginPage.jsx';

const files = fs.readdirSync(directory);

for (const filename of files) {
    if (!filename.endsWith('.jsx') || filename === exclude) continue;

    const filepath = path.join(directory, filename);
    let content = fs.readFileSync(filepath, 'utf-8');

    if (!content.includes('DashboardLayout')) continue;

    // Remove import
    content = content.replace(/import\s+DashboardLayout\s+from\s+['"]\.\.\/components\/layout\/DashboardLayout['"];?\n?/, '');

    // Insert useLayout import
    if (!content.includes('useLayout')) {
        const importMatches = [...content.matchAll(/^import\s+.*?(?:\n gm)];
        if (importMatches.length > 0) {
            const lastImport = importMatches[importMatches.length - 1];
            const insertPos = lastImport.index + lastImport[0].length;
            content = content.slice(0, insertPos) + '\nimport { useLayout } from "../context/LayoutContext";' + content.slice(insertPos);
        } else {
            content = 'import { useLayout } from "../context/LayoutContext";\n' + content;
        }
    }

    // Handle React import for useEffect
    const reactMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]react['"]/);
    if (reactMatch) {
        const reactImports = reactMatch[1];
        if (!reactImports.includes('useEffect')) {
            content = content.replace(reactMatch[0], `import {${reactImports}, useEffect} from "react"`);
        }
    } else {
        // If not found, add it
        if (!content.includes('useEffect')) {
             content = 'import { useEffect } from "react";\n' + content;
        }
    }

    // Extract title and description
    const titleMatch = content.match(/<DashboardLayout[^>]*title=({.*?}|".*?"|'.*?')[^>]*>/);
    const descMatch = content.match(/<DashboardLayout[^>]*description=({.*?}|".*?"|'.*?')[^>]*>/);

    let titleVal = titleMatch ? titleMatch[1] : '""';
    let descVal = descMatch ? descMatch[1] : '""';

    if (titleVal.startsWith('{') && titleVal.endsWith('}')) {
        titleVal = titleVal.slice(1, -1);
    }
    if (descVal.startsWith('{') && descVal.endsWith('}')) {
        descVal = descVal.slice(1, -1);
    }

    // Replace DashboardLayout with fragment
    content = content.replace(/<DashboardLayout[^>]*>/, '<>');
    content = content.replace(/<\/DashboardLayout>/g, '</>');

    // Insert hooks
    const compMatch = content.match(/(const\s+[A-Z]\w+\s*=\s*\([^)]*\)\s*=>\s*\{|function\s+[A-Z]\w+\s*\([^)]*\)\s*\{)/);
    if (compMatch) {
        const hookCode = `\n  const { setTitle, setDescription } = useLayout();\n\n  useEffect(() => {\n    setTitle(${titleVal});\n    setDescription(${descVal});\n  }, [setTitle, setDescription]);\n`;
        const insertPos = compMatch.index + compMatch[0].length;
        content = content.slice(0, insertPos) + hookCode + content.slice(insertPos);
    } else {
        console.log(`Failed to find component body for ${filename}`);
    }

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`Processed ${filename}`);
}

console.log("Done");
