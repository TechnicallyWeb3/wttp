const polygon = {
  url: "https://polygon-bor-rpc.publicnode.com",
  chainId: 137,
  blockGasLimit: 200000000,
  // accounts: defaultAccount
}

const ethereum = {
  url: "https://mainnet.ethereum.org",
  chainId: 1,
  blockGasLimit: 200000000,
  // accounts: defaultAccount
}

const sepolia = {
  url: "https://ethereum-sepolia-rpc.publicnode.com",
  chainId: 11155111,
  setBlockGasLimit: 30000000,
  // accounts: defaultAccount,
  contracts: {
    dataPointStorageAddress: "0x9A676e781A523b5d0C0e43731313A708CB607508",
    dataPointRegistryAddress: "0x9A676e781A523b5d0C0e43731313A708CB607508",
    wttpAddress: "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1"
  }
}
const base = {
  url: "https://base.org",
  chainId: 8453,
  blockGasLimit: 200000000,
  // accounts: defaultAccount
}

const config = {
  master: sepolia,
  networks: {
    localhost: {
      // accounts: defaultAccount,
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      blockGasLimit: 200000000
    },
    hardhat: {
      chainId: 1337,
      blockGasLimit: 200000000, 
      // accounts: {
      //   mnemonic: mnemonic,
      //   path: accountsPath,
      //   accountsBalance: "100000000000000000000000"
      // }
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
  }
};

export default config;
