const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const pages = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

let affected = [];
for (const page of pages) {
  const filePath = path.join(pagesDir, page);
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('<DashboardLayout') && !content.includes('Outlet')) {
      affected.push(page);
  }
}
console.log(affected);
