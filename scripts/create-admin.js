// Script to create admin user with proper password hashing

async function hashPassword(password, salt) {
  const actualSalt = salt || crypto.randomUUID();
  const encoder = new TextEncoder();
  const data = encoder.encode(password + actualSalt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${actualSalt}:${hash}`;
}

async function main() {
  // Generate password hashes
  const adminPassword = 'admin123';
  const userPassword = 'user123';
  
  const adminHash = await hashPassword(adminPassword);
  const userHash = await hashPassword(userPassword);
  
  console.log('Admin credentials:');
  console.log('Email: admin@company.com');
  console.log('Password: admin123');
  console.log('Hash:', adminHash);
  console.log('');
  console.log('User credentials:');
  console.log('Email: user@company.com');
  console.log('Password: user123');
  console.log('Hash:', userHash);
  console.log('');
  console.log('SQL to update:');
  console.log(`UPDATE users SET password_hash = '${adminHash}' WHERE email = 'admin@company.com';`);
  console.log(`UPDATE users SET password_hash = '${userHash}' WHERE email = 'user@company.com';`);
}

main();
