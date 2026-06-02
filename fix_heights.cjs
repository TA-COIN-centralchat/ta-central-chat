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
      if (file.endsWith('.jsx')) results.push(file);
    }
  });
  return results;
}
const files = walk('src/pages').concat(walk('src/components'));
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  content = content.replace(/className=\"([^\"]*?)px-4 py-2([^\"]*?)\"/g, 'className=\"$1h-10 px-4$2\"');
  content = content.replace(/className=\"([^\"]*?)px-3 py-2([^\"]*?)\"/g, 'className=\"$1h-10 px-3$2\"');
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});