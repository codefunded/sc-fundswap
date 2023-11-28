import { time, mine } from '@nomicfoundation/hardhat-network-helpers';

// utility script for increasing time on local chain fork
async function main() {
  console.log('Increasing time...');
  while (true) {
    await time.increase(time.duration.seconds(2));
    console.log(`Block mined ${new Date().toISOString()}`);
    await new Promise((resolve) => setTimeout(resolve, 2_000)); // every 2 seconds
    await mine(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
