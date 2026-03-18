require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    amoy: {
      url: "https://polygon-amoy.g.alchemy.com/v2/xr80RkvOkeD7eXElyRfAY",
      accounts: ["0xccb2766d9106ac63ae42cd579b782cf6828676ce01f300c8b96e1a9c23c96b98"],
      chainId: 80002,
      gasPrice: 35000000000,
      gas: 2000000,
    },
  },
};
