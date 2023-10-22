import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { expect } from 'chai';

describe('FundSwap plugin management', () => {
  it('allows to enable a plugin', async () => {
    const { fundSwap } = await loadFixture(prepareTestEnv);
    const tokenWhitelistPluginFactory =
      await ethers.getContractFactory('TokenWhitelistPlugin');
    const tokenWhitelistPluginInstance = await tokenWhitelistPluginFactory.deploy();
    await expect(
      fundSwap.enablePlugin(await tokenWhitelistPluginInstance.getAddress(), '0x'),
    ).to.emit(fundSwap, 'PluginEnabled');
  });

  it('allows to disable a plugin', async () => {
    const { fundSwap, feeAggregatorPlugin } = await loadFixture(prepareTestEnv);
    await fundSwap.disablePlugin(await feeAggregatorPlugin.getAddress(), '0x');
  });

  it('does nothing when plugin is already enabled', async () => {
    const { fundSwap, tokenWhitelistPlugin } = await loadFixture(prepareTestEnv);
    await expect(
      fundSwap.enablePlugin(await tokenWhitelistPlugin.getAddress(), '0x'),
    ).not.to.emit(fundSwap, 'PluginEnabled');
  });

  it('does nothing when plugin is already disabled', async () => {
    const { fundSwap, tokenWhitelistPlugin } = await loadFixture(prepareTestEnv);
    await expect(
      fundSwap.disablePlugin(await tokenWhitelistPlugin.getAddress(), '0x'),
    ).to.emit(fundSwap, 'PluginDisabled');

    await expect(
      fundSwap.disablePlugin(await tokenWhitelistPlugin.getAddress(), '0x'),
    ).to.not.emit(fundSwap, 'PluginDisabled');
  });

  it('allows to get the list of enabled plugins', async () => {
    const { fundSwap, tokenWhitelistPlugin, feeAggregatorPlugin } =
      await loadFixture(prepareTestEnv);
    expect(await fundSwap.getPlugins()).to.contain.members([
      await tokenWhitelistPlugin.getAddress(),
      await feeAggregatorPlugin.getAddress(),
    ]);
  });
});
