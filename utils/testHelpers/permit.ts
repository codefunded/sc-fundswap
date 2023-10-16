import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers, BigNumberish, Signature } from 'ethers';

interface ERC20Permit {
  nonces: (address: string) => BigNumberish | Promise<BigNumberish>;
  name: () => Promise<string>;
  getAddress: () => Promise<string>;
}

export async function getPermitSignature(
  wallet: HardhatEthersSigner,
  token: ERC20Permit,
  spender: string,
  value: BigNumberish = ethers.MaxUint256,
  deadline = ethers.MaxUint256,
  permitConfig?: {
    nonce?: BigNumberish;
    name?: string;
    chainId?: number;
    version?: string;
  },
): Promise<Signature> {
  const [nonce, name, version, chainId] = await Promise.all([
    permitConfig?.nonce ?? token.nonces(wallet.address),
    permitConfig?.name ?? token.name(),
    permitConfig?.version ?? '1',
    permitConfig?.chainId ?? (await wallet.provider.getNetwork()).chainId,
  ]);

  return Signature.from(
    await wallet.signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: await token.getAddress(),
      },
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: wallet.address,
        spender,
        value,
        nonce,
        deadline,
      },
    ),
  );
}
