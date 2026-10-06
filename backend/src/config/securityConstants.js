/**
 * securityConstants.js
 * Central list of compromised / revoked credentials from security audits.
 */

const crypto = require('crypto');

// Store one-way digests so revocation checks do not republish retired login secrets.
const COMPROMISED_LOGIN_CODE_HASHES = new Set([
  '04d9169c15c8732f1e0fedddc44213ddc93d4510866c72934459fefcc6abcdef',
  '0c4bf3c7906e7b98049b5fd346b7656f12691218ab57390e85febe80add665e1',
  '109b885bc71b4c6fe29747ee6484b7f2e296681a79531daeb07d28174f9a03c5',
  '160d9be912ec7c045237524ae9c693067ae1ecb91e17d930940aa163be0ac9cb',
  '1afd6a4350f0b4f1c3d4c0f0a6783a596ed18e5a928705d561193e4b95153dca',
  '1fcc71c9b8dadb98ac5f6424b0d51953ec57a1797f6c99956ede47df86667ded',
  '3402e51db7bf25d11eef5602a35acbbcab3abe954b9bccaeda9bf082e5252219',
  '347f76d56db9d166d8ff27b7b3ada3bf1958757ea2baeb20bb94a20b9cb5c225',
  '493bdb90bd240298d759df27d98ff8d89b0d0992f17b8444bf7a3ba4378d46a7',
  '4b790b8149bd67c92b547cd9ffa794a5bab7808aa37bbdd5abe4752c7c503944',
  '54697c253d438d96a8802e57002e48a1fc0dcec051803b5542f80334d8ad2fcd',
  '63946e6224d32dff29134fb3574d053ccc7c640340b7266b5cc06d4c0bd886be',
  '6a3595ab9011e6252aeeb8a7f3c831c9c4454f535e4fcdc18997e1c3cace8504',
  '719cad16ec31f8ef58fb5a23451f0760c92235a42fc5211822b536f3a3de2049',
  '71aee6dcca629d1b4f42e8126feb169d490635fe622b39d31fc69adb5dbeda72',
  '7dc2a19437790563d5e6f0afad4dce0a166f0f67a8aa98f321f901e9a6c554c2',
  '8a6c8ea37413a555ed9a72527cc95c6b0cd5c31917b1d79391eeacf2de735488',
  '92aba0a537f500d2839701b33c5deac80767b6eb65d699ef708e913bf725437a',
  'a197f7feea6da6b773796abd42a99b89a8830cbf414e8b88f01ae1a716df3086',
  'a21434dbebb4c399d9822a1fc1563178f12ecc0b2786b3141ba9521a30f05924',
  'a76b84e4958a957b80ce971b383ce99449b801cee42eb7fa918691dd0c219126',
  'b204591e9da0737791234641e67bf32a0beb5105c2ee7547e9930221fd656118',
  'b26d87c1fd4491638a2645040dbc465b2fc725ef9ed3d1282e7464eccc8ad796',
  'b3edc5fe2f08be65a77774f8e3f1d8f38dd396640c9f3b05d10b540e1c911dd6',
  'bb61cf5e381a0b31e3763427f3e07e8764b964e3ec4796fdb8913ffb63456e9a',
  'c5da7670a371de1f286230335093c783e5e97790d5d6b488d502344ca0e7b1cb',
  'c9d4256737ee08394f7630305115da4d81b3369b4a59fc86eafc7636c27d926e',
  'd450b11ea26a8548eb6371691c99b03a734099e67757f4587d3da433a651d171',
  'db5c45897fbc71ccb7b44c0e3ccc92b1e27b11ff9180ecc856feebc093ab1d9e',
  'f5991c4982c62e9595b044067ba4271e20cef5e2f9ae5f42ec87f674a8df1d2c',
  'faa337ccab3b8768f8e95c1894c1c755c9951c396dddb7d1492478cb0af162e0',
  'fd0e58e8b81555a686c35ffdd0e268109d8774c5289ffea73e81187a7d557a65',
]);

function hashLoginCode(code) {
  return crypto.createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex');
}

function isCompromisedLoginCode(code, hashes = COMPROMISED_LOGIN_CODE_HASHES) {
  return hashes.has(hashLoginCode(code));
}


module.exports = {
  COMPROMISED_LOGIN_CODE_HASHES,
  hashLoginCode,
  isCompromisedLoginCode
};
