import { deployFundSwap } from './deployFundSwap';
import { deployPlugins } from './deployPlugins';
import { distributeTokens } from './distributeTokens';

export const prepareTestEnv = async () => {
  const { fundSwap, fundSwapOrderManager, fundSwapBatchExecutor, privateOrderExecutor } =
    await deployFundSwap();
  const { erc20Token, usdcToken, wmaticToken } = await distributeTokens();
  const { feeAggregatorPlugin, tokenWhitelistPlugin } = await deployPlugins(fundSwap);

  await Promise.all([
    tokenWhitelistPlugin.addTokenToWhitelist(erc20Token.getAddress()),
    tokenWhitelistPlugin.addTokenToWhitelist(usdcToken.getAddress()),
    tokenWhitelistPlugin.addTokenToWhitelist(wmaticToken.getAddress()),
  ]);

  return {
    fundSwap,
    fundSwapOrderManager,
    fundSwapBatchExecutor,
    privateOrderExecutor,
    tokenWhitelistPlugin,
    feeAggregatorPlugin,
    erc20Token,
    usdcToken,
    wmaticToken,
  };
};
