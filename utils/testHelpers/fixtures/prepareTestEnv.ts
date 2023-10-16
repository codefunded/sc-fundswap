import { deployFundSwap } from './deployFundSwap';
import { distributeTokens } from './distributeTokens';

export const prepareTestEnv = async () => {
  const { fundSwap, fundSwapOrderManager, fundSwapBatchExecutor } =
    await deployFundSwap();
  const { erc20Token, usdcToken, wmaticToken } = await distributeTokens();

  await Promise.all([
    fundSwap.addTokenToWhitelist(erc20Token.getAddress()),
    fundSwap.addTokenToWhitelist(usdcToken.getAddress()),
    fundSwap.addTokenToWhitelist(wmaticToken.getAddress()),
  ]);

  return {
    fundSwap,
    fundSwapOrderManager,
    fundSwapBatchExecutor,
    erc20Token,
    usdcToken,
    wmaticToken,
  };
};
