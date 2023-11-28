import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { DEFAULT_FEE } from '../../utils/constants';
import { time } from '@nomicfoundation/hardhat-network-helpers';

// WARNING: EXPERIMENTAL
// hardhat ignition is still in alpha, so this script is not going to be used to deploy the contracts to production.
// This just serves as a proof of concept for the ignition module.
// To deploy contracts with ignition, run `npx hardhat ignition deploy ignition/modules/FundSwapModule.ts --network <network>`
export default buildModule('FundSwap', (m) => {
  const fundswap = m.contract('FundSwap', []);
  m.contract('FundSwapBatchExecutor', [fundswap]);
  m.contract('FundSwapPrivateOrderExecutor', [fundswap]);

  const feeAggregatorPlugin = m.contract('FeeAggregatorPlugin', [DEFAULT_FEE]);
  const tokenWhitelistPlugin = m.contract('TokenWhitelistPlugin', []);

  m.call(fundswap, 'enablePlugin', [feeAggregatorPlugin, '0x'], {
    id: 'feeAggregatorPluginEnable',
  });
  m.call(fundswap, 'enablePlugin', [tokenWhitelistPlugin, '0x'], {
    id: 'tokenWhitelistPluginEnable',
  });

  const deployer = m.getAccount(0);

  const timelock = m.contract('TimelockController', [
    time.duration.hours(24),
    [deployer],
    [deployer],
    deployer,
  ]);

  const defaultAdminRole = m.staticCall(fundswap, 'DEFAULT_ADMIN_ROLE');

  const timelockGrantRoleAdmin = m.call(
    fundswap,
    'grantRole',
    [defaultAdminRole, timelock],
    {
      id: 'grantAdminRoleToTimelock',
    },
  );
  const grantTreasuryOwnerRoleToDeployer = m.call(
    fundswap,
    'grantRole',
    [m.staticCall(fundswap, 'TREASURY_OWNER'), deployer],
    {
      id: 'grantTreasuryOwnerRoleToDeployer',
    },
  );
  m.call(fundswap, 'renounceRole', [defaultAdminRole, deployer], {
    after: [grantTreasuryOwnerRoleToDeployer, timelockGrantRoleAdmin],
  });

  return { fundswap };
});
