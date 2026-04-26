const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying CertifyPro contract...");

  // Get the deployer wallet
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying from wallet:", deployer.address);

  // Check wallet balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Wallet balance:", ethers.formatEther(balance), "MATIC");

  // Deploy the contract
  const CertifyPro = await ethers.getContractFactory("CertifyPro");
  const CertifyPro = await CertifyPro.deploy();
  await CertifyPro.waitForDeployment();

  const contractAddress = await CertifyPro.getAddress();
  console.log("✅ Contract deployed at:", contractAddress);

  // Save the address so backend and frontend can use it
  const deployInfo = {
    contractAddress,
    deployerAddress: deployer.address,
    network: network.name,
    deployedAt: new Date().toISOString()
  };

  // Save to smart-contract folder
  fs.writeFileSync(
    path.join(__dirname, "../deployment.json"),
    JSON.stringify(deployInfo, null, 2)
  );

  // Save to backend folder
  const backendPath = path.join(__dirname, "../../backend/contractAddress.json");
  fs.writeFileSync(backendPath, JSON.stringify(deployInfo, null, 2));

  // Save to frontend folder
  const frontendPath = path.join(__dirname, "../../frontend/src/contractAddress.json");
  if (!fs.existsSync(path.dirname(frontendPath))) {
    fs.mkdirSync(path.dirname(frontendPath), { recursive: true });
  }
  fs.writeFileSync(frontendPath, JSON.stringify(deployInfo, null, 2));

  console.log("\n📄 Contract address saved to:");
  console.log("   → smart-contract/deployment.json");
  console.log("   → backend/contractAddress.json");
  console.log("   → frontend/src/contractAddress.json");
  console.log("\n🎉 Deployment complete!");
  console.log("📋 Contract Address:", contractAddress);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});