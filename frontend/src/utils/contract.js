import { ethers } from "ethers";
import deploymentInfo from "../contractAddress.json";

const CONTRACT_ABI = [
  "function issueCertificate(bytes32 _certHash, string memory _studentName, string memory _degree, string memory _university) external",
  "function verifyCertificate(bytes32 _certHash) external view returns (bool isValid, string memory studentName, string memory degree, string memory university, uint256 issuedAt, address issuedBy)",
  "function authorizedIssuers(address) external view returns (bool)"
];

export const CONTRACT_ADDRESS = deploymentInfo.contractAddress;

// Read-only connection (no wallet needed)
export async function getReadContract() {
  const provider = new ethers.JsonRpcProvider(
    import.meta.env.VITE_POLYGON_RPC || "http://127.0.0.1:8545"
  );
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

// Write connection (requires MetaMask)
export async function getWriteContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed!");
  }
  await window.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

// Generate SHA-256 hash from a PDF file
export async function generateCertHash(file) {
  const buffer     = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  const hashHex    = hashArray
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return "0x" + hashHex;
}