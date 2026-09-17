const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const tIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>';
const oIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
const tarIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
const wIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const etaIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
const acIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"/><path d="m17 7-5-5-5 5"/><path d="m17 17-5 5-5-5"/><path d="M2 12h20"/><path d="m7 7 5 5 5-5"/><path d="m7 17 5-5 5 5"/></svg>';
const lIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>';
const cIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
const playIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;vertical-align:-3px;"><path d="M8 5v14l11-7z"/></svg>';

html = html.replace(/<div class="esensor-icon">.*?<\/div>/g, (match) => {
    if (match.includes('🌡️') || match.includes('?')) return `<div class="esensor-icon">${tIcon}</div>`;
    if (match.includes('👤')) return `<div class="esensor-icon">${oIcon}</div>`;
    if (match.includes('⚡')) return `<div class="esensor-icon">${tarIcon}</div>`;
    if (match.includes('☀️')) return `<div class="esensor-icon">${wIcon}</div>`;
    if (match.includes('📍')) return `<div class="esensor-icon">${etaIcon}</div>`;
    return match;
});

html = html.replace(/<div class="eout-icon">.*?<\/div>/g, (match) => {
    if (match.includes('❄️')) return `<div class="eout-icon">${acIcon}</div>`;
    if (match.includes('💡')) return `<div class="eout-icon">${lIcon}</div>`;
    if (match.includes('💰')) return `<div class="eout-icon">${cIcon}</div>`;
    return match;
});

html = html.replace(/>\?\s+Run Simulation</g, `>${playIcon}Run Simulation<`);
html = html.replace(/>\?\s+Run Flow</g, `>${playIcon}Run Flow<`);

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Fixed icons in index.html');
