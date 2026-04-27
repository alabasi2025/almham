import fs from 'fs';

const exe = fs.readFileSync('d:/almham/imports/ECAS-App-extracted/Electricity Customers Accounts System/Electricity Customers Accounts System.exe');

// البحث عن "mypassword4lonin" كـ UTF-16LE و ASCII
const searchTerms = ['mypassword4lonin', 'CheckData', 'Us_PassWord', 'CryptEncrypt', 'CryptDecrypt', 'CryptDeriveKey', 'CryptHashData', 'CryptAcquireContext'];

for (const term of searchTerms) {
  // ASCII
  let idx = exe.indexOf(Buffer.from(term, 'ascii'));
  if (idx !== -1) console.log(`[ASCII]  "${term}" @ 0x${idx.toString(16)}`);
  
  // UTF-16LE
  idx = exe.indexOf(Buffer.from(term, 'utf16le'));
  if (idx !== -1) {
    console.log(`[UTF16]  "${term}" @ 0x${idx.toString(16)}`);
    
    // اطبع 500 بايت حول الموقع
    const start = Math.max(0, idx - 300);
    const end = Math.min(exe.length, idx + 300);
    
    // استخرج كل النصوص UTF-16 في المنطقة
    const region = exe.subarray(start, end);
    let currentStr = '';
    let strStart = -1;
    
    for (let i = 0; i < region.length - 1; i += 2) {
      const charCode = region[i] | (region[i + 1] << 8);
      if (charCode >= 32 && charCode < 127) {
        if (strStart === -1) strStart = i;
        currentStr += String.fromCharCode(charCode);
      } else if (charCode >= 0x0600 && charCode <= 0x06FF) {
        if (strStart === -1) strStart = i;
        currentStr += String.fromCharCode(charCode);
      } else {
        if (currentStr.length >= 3) {
          console.log(`    [0x${(start + strStart).toString(16)}] "${currentStr}"`);
        }
        currentStr = '';
        strStart = -1;
      }
    }
    if (currentStr.length >= 3) {
      console.log(`    [0x${(start + strStart).toString(16)}] "${currentStr}"`);
    }
    console.log('');
  }
}

// بحث عن CryptoAPI imports
console.log('\n═══ CryptoAPI Imports ═══');
const apiCalls = ['CryptAcquire', 'CryptCreate', 'CryptHash', 'CryptDerive', 'CryptEncrypt', 'CryptDecrypt', 'CryptDestroy', 'CryptRelease', 'CryptGenKey', 'CryptImport', 'CryptExport', 'advapi32'];
for (const api of apiCalls) {
  let pos = 0;
  while (true) {
    const idx = exe.indexOf(Buffer.from(api, 'ascii'), pos);
    if (idx === -1) break;
    const context = exe.subarray(idx, Math.min(idx + 60, exe.length)).toString('ascii').replace(/[^\x20-\x7E]/g, '.');
    console.log(`  [0x${idx.toString(16)}] ${context}`);
    pos = idx + 1;
  }
}

// بحث عن CALG constants بالقرب من mypassword4lonin
console.log('\n═══ بحث عن CALG_RC4 (0x6801) و CALG_MD5 (0x8003) ═══');
const pwIdx = exe.indexOf(Buffer.from('mypassword4lonin', 'utf16le'));
if (pwIdx !== -1) {
  // ابحث في ±4KB حول الموقع
  const searchStart = Math.max(0, pwIdx - 4096);
  const searchEnd = Math.min(exe.length, pwIdx + 4096);
  
  for (let i = searchStart; i < searchEnd - 3; i++) {
    const dword = exe.readUInt32LE(i);
    if (dword === 0x00006801) console.log(`  CALG_RC4 (0x6801) @ 0x${i.toString(16)}`);
    if (dword === 0x00008003) console.log(`  CALG_MD5 (0x8003) @ 0x${i.toString(16)}`);
    if (dword === 0x00006602) console.log(`  CALG_RC2 (0x6602) @ 0x${i.toString(16)}`);
    if (dword === 0x00006601) console.log(`  CALG_DES (0x6601) @ 0x${i.toString(16)}`);
    if (dword === 0x00006603) console.log(`  CALG_3DES (0x6603) @ 0x${i.toString(16)}`);
    if (dword === 0x00008004) console.log(`  CALG_SHA1 (0x8004) @ 0x${i.toString(16)}`);
  }
}

console.log('\nDone');
