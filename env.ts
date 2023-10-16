import dotenv from 'dotenv';
dotenv.config();
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    POLYGON_MAINNET_RPC: z.string().min(1).default('https://polygon-rpc.com'),
    POLYGON_MUMBAI_RPC: z
      .string()
      .min(1)
      .default('https://matic-mumbai.chainstacklabs.com'),
    PRIVATE_KEY: z
      .string()
      .min(64)
      .default('f4e8d0152e29b2741d26d1ed0c325b41e33fce30e6b2d4deae4a712afd322e37'), // random private key for vercel deployments
    PRIVATE_KEY_2: z
      .string()
      .min(64)
      .default('0x9665068343ccf6eb6da09f39f5ac3d2d5484c94ff3069224db093b68b7659b4c'), // random private key for vercel deployments
    POLYGONSCAN_API_KEY: z.string().min(1),
  },
  clientPrefix: 'PUBLIC_',
  client: {},
  runtimeEnv: process.env,
});
