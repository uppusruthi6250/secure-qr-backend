const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRIVATE_KEY_PATH = process.env.RSA_PRIVATE_KEY_PATH || path.join(__dirname, '../keys/private.pem');
const PUBLIC_KEY_PATH = process.env.RSA_PUBLIC_KEY_PATH || path.join(__dirname, '../keys/public.pem');

// Initialize RSA 2048-bit Key Pair if not already existing
const initializeRSAKeys = () => {
  try {
    const keysDir = path.dirname(PRIVATE_KEY_PATH);
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }

    if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
      console.log('🔑 Generating new RSA 2048-bit Server Key Pair for digital signatures...');
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
      fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
      console.log('✅ RSA Key Pair successfully generated and securely saved on server.');
    } else {
      console.log('🔑 Server RSA Digital Signature Keys loaded.');
    }
  } catch (error) {
    console.error(`❌ Error initializing RSA keys: ${error.message}`);
  }
};

// Deterministic Canonicalization of QR payment data
const canonicalizeQrData = ({ organizationId, organizationName, upiId, paymentData }) => {
  const cleanOrgId = (organizationId || '').trim();
  const cleanOrgName = (organizationName || '').trim();
  const cleanUpi = (upiId || '').trim().toLowerCase();
  const cleanPaymentData = (paymentData || '').trim();

  return `organizationId=${cleanOrgId}|organizationName=${cleanOrgName}|upiId=${cleanUpi}|paymentData=${cleanPaymentData}`;
};

// Calculate SHA-256 Hash
const calculateSHA256 = (dataString) => {
  return crypto.createHash('sha256').update(dataString, 'utf8').digest('hex');
};

// Sign data using Server's RSA Private Key
const signDataRSA = (dataString) => {
  const privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
  const signer = crypto.createSign('SHA256');
  signer.update(dataString);
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
};

// Verify RSA Digital Signature using Server's RSA Public Key
const verifyDataRSA = (dataString, signatureBase64) => {
  try {
    const publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    const verifier = crypto.createVerify('SHA256');
    verifier.update(dataString);
    verifier.end();
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch (error) {
    console.error(`❌ RSA Signature verification exception: ${error.message}`);
    return false;
  }
};

module.exports = {
  initializeRSAKeys,
  canonicalizeQrData,
  calculateSHA256,
  signDataRSA,
  verifyDataRSA,
};
