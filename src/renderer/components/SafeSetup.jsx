import React, { useState } from "react";
import { ethers } from "ethers";
import Safe from "@safe-global/protocol-kit";
import TxComposerSDK from "./TxComposer.jsx";
import { useSafe } from '../context/SafeContext';

const RPC_URL = import.meta.env.VITE_RPC_URL;
const CHAIN_ID = BigInt(import.meta.env.VITE_CHAIN_ID || 11155111);
const SERVER_URL = 'http://localhost:3000';

export default function SafeSetup() {
  const [keyPairs, setKeyPairs] = useState(null);
  const [serverPublicKey, setServerPublicKey] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [safeAddress, setSafeAddress] = useState(null);
  const [safeInfo, setSafeInfo] = useState(null); // { address, privateKey }
  const [showComposer, setShowComposer] = useState(false);
  const [checkedBalance, setCheckedBalance] = useState(false);

  const saveKeyAndAddressToFile = (privateKey, safeAddress) => {
    try {
      const content = `Private Key (Key 1):\n${privateKey}\n\nSafe Address:\n${safeAddress}\n`;
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "safe-key-and-address.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to save file:", e);
    }
  };

  const fs = window.require ? window.require('fs') : null;
const path = window.require ? window.require('path') : null;

const saveSafeAddressToFile = async (address) => {
  if (window?.electronAPI?.saveSafeAddressToFile) {
    try {
      const result = await window.electronAPI.saveSafeAddressToFile(address);
      if (result.success) {
        console.log('✅ Safe address saved to:', result.filePath);
      } else {
        console.error('❌ Failed to save file:', result.error);
      }
    } catch (err) {
      console.error('❌ IPC error while saving file:', err);
    }
  } else {
    console.warn('Electron API not available (not running in Electron)');
  }
};


  const handleGenerateTwoKeys = () => {
    try {
      const wallet1 = ethers.Wallet.createRandom();
      const wallet2 = ethers.Wallet.createRandom();

      setKeyPairs({
        key1: {
          address: wallet1.address,
          privateKey: wallet1.privateKey,
          mnemonic: wallet1.mnemonic.phrase,
        },
        key2: {
          address: wallet2.address,
          privateKey: wallet2.privateKey,
          mnemonic: wallet2.mnemonic.phrase,
        },
      });

      setStatus(
        "Generated two keypairs. Please SAVE the private key of Key 1 securely!"
      );
      setError("");
    } catch (err) {
      setError("Failed to generate key pairs: " + err.message);
      setStatus("");
    }
  };

  const handleGetServerPublicKey = () => {
    try {
      setError('');
      const hardcodedServerKey = "0xAB077537DbC54088b6c2Da1a838300Bb8152165E";  // This is a hardcoded key for testing
      setServerPublicKey(hardcodedServerKey);
      setStatus(`✅ Server public key: ${hardcodedServerKey}`);
      setError("");
    } catch (err) {
      setError(`Failed to get server public key: ${err.message}`);
      setStatus("");
    }
  };

  const handleDeploySafe = async () => {
    if (!keyPairs || !serverPublicKey) {
      setError("Please generate keys and get server public key first.");
      return;
    }

    try {
      setStatus("Deploying Safe contract...");
      setError("");

      const owners = [
        keyPairs.key1.address,
        keyPairs.key2.address,
        serverPublicKey,
      ];
      const threshold = 2;

      const signer = keyPairs.key1.privateKey;
      const protocolKit = await Safe.init({
        provider: RPC_URL,
        signer,
        predictedSafe: { safeAccountConfig: { owners, threshold } },
        chainId: CHAIN_ID,
      });

      const predictedAddress = await protocolKit.getAddress();
      
      // Create a wallet from the private key for deployment
      const wallet = new ethers.Wallet(keyPairs.key1.privateKey, new ethers.providers.JsonRpcProvider(RPC_URL));
      
      // Create and send the deployment transaction
      const deploymentTx = await protocolKit.createSafeDeploymentTransaction();
      
      // Check wallet balance
      const balance = await wallet.getBalance();
      console.log('Wallet balance:', ethers.utils.formatEther(balance), 'ETH');
      
      if (balance.isZero()) {
        const faucetLinks = `
          • Alchemy Sepolia Faucet: https://sepoliafaucet.com/
          • Sepolia PoW Faucet: https://sepolia-faucet.pk910.de/
          • Infura Sepolia Faucet: https://faucet.sepolia.dev/
        `;
        throw new Error(`Account ${wallet.address} has no ETH. Please fund this address with some Sepolia ETH first.\n\nYou can get test ETH from these faucets:\n${faucetLinks}`);
      }

      // Set manual gas limit and higher gas price for Sepolia
      const txResponse = await wallet.sendTransaction({
        to: deploymentTx.to,
        data: deploymentTx.data,
        value: deploymentTx.value || '0',
        gasLimit: 1000000, // Manual gas limit
        maxFeePerGas: ethers.utils.parseUnits('20', 'gwei'), // Higher gas price
        maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei'),
        type: 2 // EIP-1559 transaction
      });
      
      setStatus('⏳ Waiting for deployment transaction to be mined...');
      await txResponse.wait();

      const newSafeInfo = { address: predictedAddress, privateKey: keyPairs.key1.privateKey };
      setSafeInfo(newSafeInfo);

      // 🔹 Send Safe address to Electron main (update config.yaml)
      if (window?.electronAPI) {
        await window.electronAPI.updateContractAddress(predictedAddress);
      }

      // 🔹 Notify parent (App.jsx)
      if (onSafeDeployed) onSafeDeployed(predictedAddress);

      // 🔹 Save locally
      localStorage.setItem("safeAddress", predictedAddress);

      setStatus(`✅ Safe deployed at: ${predictedAddress}`);
      setError("");

      saveKeyAndAddressToFile(keyPairs.key1.privateKey, predictedAddress);

      // 🔹 Regenerate Envio config
      await fetch(`${SERVER_URL}/generate-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ safeAddress: predictedAddress }),
      });
    } catch (err) {
      setError(`${err.message}`);
      setStatus("");
    }
  };

  // Already defined later in the code

  if (showComposer && (safeInfo || (usePredefinedSafe && PREDEFINED_SAFE))) {
    const safeToUse = usePredefinedSafe ? PREDEFINED_SAFE : safeInfo.address;
    // Use generated keys if available, otherwise empty strings
    const owner1KeyToUse = keyPairs?.key1?.privateKey || '';
    const owner2KeyToUse = keyPairs?.key2?.privateKey || '';
    return (
      <TxComposerSDK
        safeAddress={safeToUse}
        owner1Key={owner1KeyToUse}
        owner2Key={owner2KeyToUse}
        serverKey={"0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199"}
        onNavigate={(page) => {
          if (page === 'safe-setup') {
            setShowComposer(false);
          }
        }}
      />
    );
  }

  const checkBalance = async () => {
    if (!keyPairs) {
      setError('Please generate keys first');
      return;
    }

    try {
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const balance = await provider.getBalance(keyPairs.key1.address);
      const balanceInEth = ethers.utils.formatEther(balance);
      setCheckedBalance(true);
      
      if (balance.isZero()) {
        setStatus(`Current balance: ${balanceInEth} ETH\nYou need Sepolia ETH to deploy a Safe. Click "Get Test ETH" to visit faucets.`);
      } else {
        setStatus(`Current balance: ${balanceInEth} ETH\nYou have enough ETH to proceed!`);
      }
    } catch (err) {
      setError('Failed to check balance: ' + err.message);
    }
  };

  const handleGetTestEth = () => {
    if (!keyPairs) {
      setError('Please generate keys first');
      return;
    }
    
    const faucets = [
      `https://sepoliafaucet.com/`,
      `https://sepolia-faucet.pk910.de/`,
      `https://faucet.sepolia.dev/`
    ];
    
    setStatus(`
Opening Sepolia faucets in new tabs. 
Your address to fund: ${keyPairs.key1.address}

1. Copy your address above
2. Visit each faucet
3. Request test ETH
4. Wait a few minutes
5. Click "Check Balance" to verify
    `);
    faucets.forEach(url => window.open(url, '_blank'));
  };

  return (
    <div style={styles.container}>
      <h1>Safe 2-of-3 Multisig Setup</h1>

      {!usePredefinedSafe && !safeInfo && PREDEFINED_SAFE && (
        <div style={styles.section}>
          <h2>Quick Start Option</h2>
          <p>Use an existing pre-deployed Safe to start testing immediately:</p>
          <button 
            style={{...styles.button, backgroundColor: '#9C27B0'}} 
            onClick={() => {
              setUsePredefinedSafe(true);
              setShowComposer(true);
            }}
          >
            Use Pre-deployed Safe ({PREDEFINED_SAFE.substring(0, 6)}...{PREDEFINED_SAFE.substring(38)})
          </button>
          <p style={styles.note}>Or continue below to deploy your own Safe</p>
        </div>
      )}

      <div style={styles.section}>
        <h2>Step 1: Generate 2 Local Key Pairs</h2>
        <button style={styles.button} onClick={handleGenerateTwoKeys}>
          Generate Keys
        </button>
        {keyPairs && (
          <>
            <div style={styles.keyBox}>
              <h3>Key 1 (Save privately!)</h3>
              <p>Address: {keyPairs.key1.address}</p>
              <p>Private Key: <code>{keyPairs.key1.privateKey}</code></p>
              <p>Mnemonic: <code>{keyPairs.key1.mnemonic}</code></p>

              <h3>Key 2</h3>
              <p>Address: {keyPairs.key2.address}</p>
              <p>Private Key: <code>{keyPairs.key2.privateKey}</code></p>
              <p>Mnemonic: <code>{keyPairs.key2.mnemonic}</code></p>
            </div>
            
            {!usePredefinedSafe && (
              <div style={styles.fundingBox}>
                <h3>Get Sepolia Test ETH</h3>
                <p>You need some test ETH to deploy your Safe</p>
                <div style={styles.buttonGroup}>
                  <button style={{...styles.button, backgroundColor: '#FF9800'}} onClick={handleGetTestEth}>
                    Get Test ETH
                  </button>
                  <button style={{...styles.button, backgroundColor: '#2196F3'}} onClick={checkBalance}>
                    Check Balance
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={styles.section}>
        <h2>Step 2: Get Server Public Key</h2>
        <button style={styles.button} onClick={handleGetServerPublicKey}>
          Request Server Key
        </button>
        {serverPublicKey && (
          <div style={styles.keyInfo}>
            <p>
              <strong>Server Public Key:</strong>
            </p>
            <code style={styles.code}>{serverPublicKey}</code>
          </div>
        )}
      </div>

      <div style={styles.section}>
        <h2>Step 3: Deploy Safe Contract</h2>
        <button style={styles.deployButton} onClick={handleDeploySafe}>
          Deploy Safe
        </button>
      </div>

      {safeInfo && (
        <div style={styles.section}>
          <h2>Next</h2>
          <p>
            <strong>Safe:</strong> {safeInfo.address}
          </p>
          <button
            style={{ ...styles.deployButton, backgroundColor: "#8E44AD" }}
            onClick={() => setShowComposer(true)}
          >
            Open Transaction Composer
          </button>
        </div>
      )}

      {status && <p style={styles.status}>{status}</p>}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles = {
  container: { maxWidth: 900, margin: 'auto', padding: 20, fontFamily: 'Arial, sans-serif' },
  section: { marginBottom: 30, padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#f9f9f9' },
  button: { padding: '12px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 16, margin: '0 10px 10px 0' },
  deployButton: { padding: '12px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 16 },
  keyBox: { backgroundColor: '#fff3cd', border: '2px solid #ff9800', borderRadius: 4, padding: 15, marginBottom: 20 },
  status: { padding: 10, backgroundColor: '#e7f3ff', color: '#0066cc', borderRadius: 4, marginTop: 10, whiteSpace: 'pre-wrap' },
  error: { padding: 10, backgroundColor: '#ffe7e7', color: '#cc0000', borderRadius: 4, marginTop: 10 },
  keyInfo: { 
    backgroundColor: '#e8f5e9', 
    border: '1px solid #66bb6a',
    borderRadius: 8, 
    padding: 20,
    marginTop: 15,
  },
  code: {
    display: "block",
    padding: 15,
    backgroundColor: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: 4,
    fontFamily: "monospace",
    fontSize: "14px",
    overflowWrap: "break-word",
    marginTop: 10,
    marginBottom: 10,
  },
  note: {
    color: '#666',
    fontStyle: 'italic',
    marginTop: 10,
    fontSize: '14px'
  },
  fundingBox: {
    backgroundColor: '#e3f2fd',
    border: '1px solid #42a5f5',
    borderRadius: 4,
    padding: 15,
    marginTop: 20
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px'
  }
};