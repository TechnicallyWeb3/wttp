import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-switch-network";
import "hardhat-docgen";
import dotenv from "dotenv";
import { setBlockGasLimit } from "@nomicfoundation/hardhat-toolbox/network-helpers";

dotenv.config();

const mnemonic = process.env.WTTP_MNEMONIC || "test test test test test test test test test test test junk";
// console.log(mnemonic.split(' ')[0]);
const accountsPath = "m/44'/60'/0'/0";
const accountsCount = 5;
const defaultAccount = {
  mnemonic: mnemonic,
  path: accountsPath,
  count: accountsCount
}

const polygon = {
  url: "https://polygon-bor-rpc.publicnode.com",
  chainId: 137,
  blockGasLimit: 200000000,
  accounts: defaultAccount
}

const ethereum = {
  url: "https://mainnet.ethereum.org",
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
  url: "https://base.org",
  chainId: 8453,
  blockGasLimit: 200000000,
  accounts: defaultAccount
}

const config: HardhatUserConfig = {
  solidity: "0.8.27",
  networks: {
    hardhat: {
      chainId: 1337,
      blockGasLimit: 200000000, 
      accounts: {
        mnemonic: mnemonic,
        path: accountsPath,
        count: accountsCount,
        accountsBalance: "100000000000000000000000"
      }
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
    "8453": base
  },
  docgen: {
    path: './docs/solidity',
    clear: true,
    runOnCompile: false
  }
};

export default config;
