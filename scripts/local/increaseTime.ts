import { time } from '@nomicfoundation/hardhat-network-helpers';

// utility script for increasing time on local chain fork
async function main() {
  console.log('Increasing time...');
  while (true) {
    await time.increase(time.duration.seconds(60));
    console.log('Time increased by 60 seconds');
    await new Promise((resolve) => setTimeout(resolve, 10000)); // every 10 seconds
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
