/**
 * Genera config.js per deploy (es. Vercel) dalle variabili d'ambiente.
 * SUPABASE_URL + SUPABASE_ANON_KEY
 */
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'config.js');
const publicConfigPath = path.join(__dirname, '..', 'supabase.config.js');
let url = process.env.SUPABASE_URL || '';
let anonKey = process.env.SUPABASE_ANON_KEY || '';

if ((!url || !anonKey) && fs.existsSync(publicConfigPath)) {
    const publicSrc = fs.readFileSync(publicConfigPath, 'utf8');
    if (!url) {
        const urlMatch = publicSrc.match(/url:\s*['"]([^'"]+)['"]/);
        url = urlMatch ? urlMatch[1] : '';
    }
    if (!anonKey) {
        const keyMatch = publicSrc.match(/anonKey:\s*['"]([^'"]+)['"]/);
        anonKey = keyMatch ? keyMatch[1] : '';
    }
}

if (!url || !anonKey) {
    console.error('Supabase non configurato: imposta SUPABASE_URL e SUPABASE_ANON_KEY su Vercel oppure compila supabase.config.js');
    process.exit(1);
}

const contents = `/** Generated at build time — do not edit manually */
window.CRM_SUPABASE_CONFIG = {
    url: ${JSON.stringify(url)},
    anonKey: ${JSON.stringify(anonKey)}
};
`;

fs.writeFileSync(outputPath, contents, 'utf8');
console.log('config.js generated for deploy');
