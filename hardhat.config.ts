import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-switch-network";
import "hardhat-docgen";
import dotenv from "dotenv";
// import { setBlockGasLimit } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { ethers } from "ethers";

dotenv.config();

const mnemonic = process.env.WTTP_MNEMONIC || "test test test test test test test test test test test junk";
// console.log(mnemonic.split(' ')[0]);
const accountsPath = "m/44'/60'/0'/0";
const accountsCount = 3;
// const defaultAccount = {
//   mnemonic: mnemonic,
//   path: accountsPath,
//   count: accountsCount
// }

const defaultAccount = [
  process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cdb9d98f34",  // Add a default testing private key
  process.env.DPs_DEPLOYER || "",
  process.env.DPR_DEPLOYER || "",
  process.env.WTTP_DEPLOYER || "",
].filter(key => key !== "");  // Remove empty strings

// const defaultAccount = {
//   accounts: privateKeys
// }

const polygon = {
  url: "https://polygon-bor-rpc.publicnode.com",
  chainId: 137,
  blockGasLimit: 200000000,
  accounts: defaultAccount
}

const ethereum = {
  url: "https://ethereum-rpc.publicnode.com",
  chainId: 1,
  blockGasLimit: 200000000,
  accounts: defaultAccount
}

const sepolia = {
  url: "https://ethereum-sepolia-rpc.publicnode.com",
  chainId: 11155111,
  setBlockGasLimit: 30000000,
  accounts: defaultAccount
}
const base = {
  url: "https://base-rpc.publicnode.com",
  chainId: 8453,
  blockGasLimit: 200000000,
  accounts: defaultAccount
}

const fantom = {
  url: "https://fantom-rpc.publicnode.com",
  chainId: 250,
  blockGasLimit: 200000000,
  accounts: defaultAccount
}

const arbitrum = {
  url: "https://arbitrum-one-rpc.publicnode.com",
  chainId: 42161,
  blockGasLimit: 200000000,
  accounts: defaultAccount
}

const avalanche = {
  url: "https://avalanche-c-chain-rpc.publicnode.com",
  chainId: 43114,
  blockGasLimit: 200000000,
  accounts: defaultAccount
}

const optimism = {
  url: "https://optimism-rpc.publicnode.com",
  chainId: 10,
  blockGasLimit: 200000000,
  accounts: defaultAccount
}

const config: HardhatUserConfig = {
  solidity: "0.8.27",
  networks: {
    hardhat: {
      chainId: 1337,
      blockGasLimit: 200000000, 
      accounts: defaultAccount.map(key => ({
        privateKey: key,
        balance: "10000000000000000000000"  // 10000 ETH in wei
      }))
    },
    polygon: polygon,
    pol: polygon,
    "137": polygon,
    ethereum: ethereum,
    eth: ethereum,
    "1": ethereum,
    sepolia: sepolia,
    seth: sepolia,
    "11155420": sepolia,
    base: base,
    "8453": base,
    fantom: fantom,
    ftm: fantom,
    "250": fantom,
    arbitrum: arbitrum,
    arb: arbitrum,
    "42161": arbitrum,
    avalanche: avalanche,
    avax: avalanche,
    "43114": avalanche,
    optimism: optimism,
    op: optimism,
    "10": optimism,
  },
  docgen: {
    path: './docs/solidity',
    clear: true,
    runOnCompile: false
  }
};

export default config;
