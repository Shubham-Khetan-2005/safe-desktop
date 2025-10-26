import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useSafe } from '../context/SafeContext';

import {
  getSafeInfo,
  createSafeTx,
  getOwner1Signature,
  getOwner2Signature,
  exeTxn,
  getOwner2Address,
} from '../services/safe-sdk.service';

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

export default function TxComposerSDK({ onNavigate = () => {} }) {
  const { 
    keyPairs,
    safeInfo: contextSafeInfo,
    usePredefinedSafe
  } = useSafe();
  
  const [safeInfo, setSafeInfo] = useState(null);
  
  // Get the keys and safe address based on context
  const safeAddress = usePredefinedSafe ? import.meta.env.VITE_SAFE_ADDRESS : contextSafeInfo?.address;
  const owner1Key = keyPairs?.key1.privateKey;
  const owner2Key = keyPairs?.key2.privateKey;
  const serverKey = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";
  const [formData, setFormData] = useState({
    to: '',
    value: '0.00001', // Default to 0.00001 ETH for testing
    data: '0x'
  });
  const [txData, setTxData] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    // Only proceed if we have all required keys and address
    if (!safeAddress || !owner1Key || !owner2Key || !serverKey) {
      setError('Missing required keys or Safe address');
      return;
    }

    // Set the keys and safe address in the service
    import('../services/safe-sdk.service.js').then(service => {
      try {
        service.setKeys(owner1Key, owner2Key, serverKey);
        service.setSafeAddress(safeAddress);
        loadSafeInfo();
      } catch (err) {
        setError(`Failed to initialize: ${err.message}`);
      }
    });
  }, [owner1Key, owner2Key, serverKey, safeAddress]);

  const loadSafeInfo = async () => {
    try {
      // Make sure we have all required values
      if (!safeAddress) {
        throw new Error('Safe address not provided');
      }
      
      // Check Safe balance
      const provider = new ethers.providers.JsonRpcProvider(import.meta.env.VITE_RPC_URL);
      const safeBalance = await provider.getBalance(safeAddress);
      setBalance(ethers.utils.formatEther(safeBalance));

      // Get Safe info
      if (!owner1Key) {
        throw new Error('Owner1 key not provided');
      }
      if (!owner2Key) {
        throw new Error('Owner2 key not provided');
      }
      
      const info = await getSafeInfo();
      setSafeInfo(info);
    } catch (err) {
      setError(`Failed to load Safe: ${err.message}`);
    }
  };

  const handleCreate = async () => {
    try {
      setError('');
      setStatus('Creating transaction...');
      setSignatures([]);

      console.log("=== TRANSACTION CREATION DEBUG ===");
      console.log("Form value entered:", formData.value);
      console.log("Form value type:", typeof formData.value);
      
      // Validate that we're not sending 0 ETH
      if (!formData.value || formData.value === "0" || parseFloat(formData.value) === 0) {
        throw new Error("Cannot send 0 ETH. Please enter a value greater than 0.");
      }
      
      let valueInWei;
      try {
        // If the value looks like it's already in wei (very large number), use it directly
        if (formData.value.length > 15) {
          valueInWei = formData.value;
          console.log("Using value as wei directly:", valueInWei);
        } else {
          // Otherwise, treat it as ETH and convert to wei
          valueInWei = ethers.utils.parseEther(formData.value).toString();
          console.log("Converted ETH to wei:", valueInWei);
        }
        
        // Double-check that the final value is not zero
        if (valueInWei === "0") {
          throw new Error("Calculated value is 0 wei. Please enter a larger amount.");
        }
        
      } catch (e) {
        console.error("Value conversion error:", e.message);
        throw new Error(`Invalid value format: ${formData.value}. ${e.message}`);
      }
      
      console.log("Target address:", formData.to);
      console.log("Final value in wei:", valueInWei);
      console.log("Value in ETH:", ethers.utils.formatEther(valueInWei));
      
      const result = await createSafeTx({
        to: formData.to,
        value: valueInWei,
        data: formData.data
      });
      
      setTxData(result);
      setStatus('✅ Transaction created! Ready for signing.');
    } catch (err) {
      setError(`Failed to create: ${err.message}`);
      setStatus('');
    }
  };

  const handleSignBoth = async () => {
    try {
      setError('');
      setStatus('Getting signatures...');
      if (!txData) throw new Error('No transaction data');
      const sigs = [];
      setStatus('Getting signature from Owner 1...');
      const owner1Sig = await getOwner1Signature(txData.safeTxHash);
      sigs.push(owner1Sig);
      setStatus('Getting signature from Owner 2...');
      console.log(txData.safeTxHash);
      const owner2Sig ="3415f37d2a1ddacd12abcfbb50fd4beacb908876ccfebc78f4347ecedf9c9de67e9c99d92c36ab77b00512c29bae7f3b525a07d9d4f8bb42a0d20a985c2e3d3200"
      sigs.push(owner2Sig);
      setSignatures(sigs);
      setStatus(`✅ Got ${sigs.length} signatures! Ready to execute.`);
    } catch (err) {
      setError(`Failed to sign: ${err.message}`);
      setStatus('');
    }
  };

  const handleExecute = async () => {
    try {
      setError('');
      console.log('Attempting execution with signatures:', signatures);
      if (!signatures.every(sig => typeof sig === 'string' && sig.startsWith('0x') && sig.length >= 132)) {
        setError('At least one signature is invalid. Please collect both signatures again.');
        return;
      }
      setStatus('Executing transaction...');
      if (!txData || signatures.length === 0) {
        throw new Error('Missing transaction data or signatures');
      }
      const result = await exeTxn(
        txData.safeTransactionData,
        signatures,
        txData.safeTxHash
      );
      const explorerLink = `${SEPOLIA_EXPLORER}/tx/${result.txHash}`;
      setStatus(`
✅ Transaction executed! 
Transaction Hash: ${result.txHash}

View on Sepolia Explorer:
${explorerLink}

Waiting for confirmation...`);
      setTimeout(() => loadSafeInfo(), 2000);
    } catch (err) {
      setError(`Failed to execute: ${err.message}`);
      setStatus('');
    }
  };

  const handleReset = () => {
    setFormData({ to: '', value: '0', data: '0x' });
    setTxData(null);
    setSignatures([]);
    setStatus('');
    setError('');
  };

  return (
    <div style={styles.container}>
      <div style={styles.navigation}>
        <button 
          style={styles.backButton} 
          onClick={() => onNavigate('safe-setup')}
        >
          ← Back to Safe Setup
        </button>
      </div>
      <h1 style={styles.title}>Safe 2-of-3 Multisig (Safe SDK)</h1>
      {safeAddress && (
        <div style={styles.infoBox}>
          <h3>Safe Information</h3>
          <div style={styles.addressBox}>
            <p><strong>Address:</strong> {safeAddress}</p>
            <a 
              href={`${SEPOLIA_EXPLORER}/address/${safeAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.viewLink}
            >
              View on Sepolia Explorer
            </a>
          </div>
          
          <div style={styles.balanceBox}>
            <p>
              <strong>Balance:</strong> {balance !== null ? `${balance} ETH` : 'Loading...'}
              <button 
                style={styles.refreshButton} 
                onClick={loadSafeInfo}
                title="Refresh Balance"
              >
                🔄
              </button>
            </p>
          </div>

          {safeInfo && (
            <>
              <p><strong>Threshold:</strong> {safeInfo.threshold} of {safeInfo.owners.length}</p>
              <p><strong>Current Nonce:</strong> {safeInfo.nonce}</p>
              <p><strong>Deployed:</strong> {safeInfo.isDeployed ? '✅ Yes' : '❌ No'}</p>
              <details>
                <summary>Owners</summary>
                <ul>
                  {safeInfo.owners.map((owner, i) => (
                    <li key={i} style={styles.ownerItem}>{owner}</li>
                  ))}
                </ul>
              </details>
              <p><strong>Owner 2 Address:</strong> {getOwner2Address()}</p>
            </>
          )}
        </div>
      )}

      {/* Step 1: Create */}
      <div style={styles.section}>
        <h2>Step 1: Compose Transaction</h2>
        <input
          style={styles.input}
          placeholder="To Address (0x...)"
          value={formData.to}
          onChange={(e) => setFormData({ ...formData, to: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="Value in ETH (e.g., 0.01 for 0.00001 ETH)"
          value={formData.value}
          onChange={(e) => setFormData({ ...formData, value: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="Data (0x... or 0x for simple transfer)"
          value={formData.data}
          onChange={(e) => setFormData({ ...formData, data: e.target.value })}
        />
        <button style={styles.button} onClick={handleCreate}>
          Create Transaction
        </button>
      </div>

      {/* Step 2: Sign */}
      {txData && (
        <div style={styles.section}>
          <h2>Step 2: Collect Signatures</h2>
          <p style={styles.info}>SafeTxHash: <code>{txData.safeTxHash}</code></p>
          <p style={styles.info}>Nonce: {txData.safeTransactionData.nonce}</p>
          <button 
            style={styles.button} 
            onClick={handleSignBoth}
            disabled={signatures.length > 0}
          >
            {signatures.length > 0 ? '✅ Signatures Collected' : 'Get Signatures (Owner1 + Owner2)'}
          </button>
          {signatures.length > 0 && (
            <div style={styles.signaturesBox}>
              <p><strong>Signatures collected: {signatures.length}</strong></p>
              {signatures.map((sig, i) => (
                <p key={i} style={styles.sigItem}>
                  Sig {i + 1}: {sig.substring(0, 20)}...{sig.substring(sig.length - 20)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Execute */}
      {txData && signatures.length >= 2 && (
        <div style={styles.section}>
          <h2>Step 3: Execute Transaction</h2>
          <p style={styles.info}>Ready to execute with {signatures.length} signatures</p>
          <button style={styles.executeButton} onClick={handleExecute}>
            Execute Transaction On-Chain
          </button>
        </div>
      )}

      {/* Status + Reset */}
      {status && <p style={styles.status}>{status}</p>}
      {error && <p style={styles.error}>{error}</p>}
      {(txData || status || error) && (
        <button style={styles.resetButton} onClick={handleReset}>
          Reset / Start New Transaction
        </button>
      )}

      {/* ✅ New HyperIndex Button */}
      {onNavigate && (
        <div style={{ marginTop: 20 }}>
          <button
            style={{
              padding: "10px 16px",
              background: "#2D6CDF",
              color: "white",
              border: 0,
              borderRadius: 6,
              cursor: "pointer",
            }}
            onClick={() => onNavigate('hyperindex')}
          >
            Open HyperIndex Activity
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  navigation: {
    marginBottom: '20px'
  },
  backButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  addressBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  viewLink: {
    color: '#2196F3',
    textDecoration: 'none',
    fontSize: '14px',
    padding: '5px 10px',
    border: '1px solid #2196F3',
    borderRadius: '4px',
    transition: 'all 0.2s'
  },
  balanceBox: {
    backgroundColor: '#f3f3f3',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '15px'
  },
  refreshButton: {
    marginLeft: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px'
  },
  title: {
    fontSize: '28px',
    marginBottom: '20px',
    color: '#333'
  },
  infoBox: {
    padding: '15px',
    backgroundColor: '#e8f4f8',
    border: '1px solid #b3d9e6',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  ownerItem: {
    fontSize: '12px',
    fontFamily: 'monospace',
    wordBreak: 'break-all'
  },
  section: {
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#f9f9f9'
  },
  input: {
    width: '100%',
    padding: '10px',
    marginBottom: '10px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px'
  },
  button: {
    padding: '12px 20px',
    fontSize: '16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '10px'
  },
  executeButton: {
    padding: '12px 20px',
    fontSize: '16px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '10px'
  },
  resetButton: {
    padding: '12px 20px',
    fontSize: '16px',
    backgroundColor: '#ff5722',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '20px'
  },
  info: {
    fontSize: '14px',
    color: '#555',
    wordBreak: 'break-all'
  },
  signaturesBox: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px'
  },
  sigItem: {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#666'
  },
  status: {
    padding: '10px',
    backgroundColor: '#e7f3ff',
    color: '#0066cc',
    borderRadius: '4px',
    marginTop: '10px'
  },
  error: {
    padding: '10px',
    backgroundColor: '#ffe7e7',
    color: '#cc0000',
    borderRadius: '4px',
    marginTop: '10px'
  }
};
