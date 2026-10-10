import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('Uso: node scripts/hash-password.js TuContraseña');
  process.exit(1);
}

console.log(await bcrypt.hash(password, 12));
