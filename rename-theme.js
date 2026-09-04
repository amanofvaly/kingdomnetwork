const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.css')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./client/src');
let changed = 0;

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    // We only replace exact word boundary matches of green to avoid breaking other words
    const newContent = content
      .replace(/\bgreen\b/g, 'blue')
      .replace(/\bGreen\b/g, 'Blue');
      
    if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        changed++;
        console.log(`Updated ${file}`);
    }
});

console.log(`Done. Changed ${changed} files.`);
