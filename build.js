const fs = require('fs');
const path = require('path');

const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || ''
};

const configContent = `window.APP_CONFIG = {
    SUPABASE_URL: '${config.SUPABASE_URL}',
    SUPABASE_ANON_KEY: '${config.SUPABASE_ANON_KEY}',
    DEEPSEEK_API_KEY: '${config.DEEPSEEK_API_KEY}'
};`;

fs.writeFileSync(path.join(__dirname, 'config.js'), configContent);
console.log('config.js generated successfully');
console.log('SUPABASE_URL:', config.SUPABASE_URL ? '“—≈‰÷√' : 'Œ¥≈‰÷√');
console.log('SUPABASE_ANON_KEY:', config.SUPABASE_ANON_KEY ? '“—≈‰÷√' : 'Œ¥≈‰÷√');
console.log('DEEPSEEK_API_KEY:', config.DEEPSEEK_API_KEY ? '“—≈‰÷√' : 'Œ¥≈‰÷√');
