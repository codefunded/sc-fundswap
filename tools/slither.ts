import { spawnSync } from 'child_process';
import fs from 'fs/promises';

// due to the monroepo structure, we need to copy the openzeppelin and solidstate contracts to the node_modules folder
// so that slither can find them

const copyOpenZeppelinContracts = async () => {
  return Promise.all([
    fs.cp('../../node_modules/@openzeppelin/', './node_modules/@openzeppelin/', {
      recursive: true,
      force: true,
    }),
    fs.cp('../../node_modules/@solidstate/', './node_modules/@solidstate/', {
      recursive: true,
      force: true,
    }),
  ]);
};

async function main() {
  await copyOpenZeppelinContracts();

  spawnSync(
    'slither',
    [
      '.',
      '--solc-remaps',
      '"@openzeppelin=node_modules/@openzeppelin, @solidstate=node_modules/@solidstate"',
      '--exclude-dependencies',
      // '--hardhat-ignore-compile',
    ],
    { stdio: 'inherit' },
  );
}
main();
