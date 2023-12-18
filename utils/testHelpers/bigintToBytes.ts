export const bigintToBytes = (value: bigint) => {
  // Convert the integer to a hex string
  let hexString = value.toString(16);

  // Pad the hex string so it represents 32 bytes (64 characters)
  while (hexString.length < 64) {
    hexString = '0' + hexString;
  }

  // Return the padded hex string
  return '0x' + hexString;
};
