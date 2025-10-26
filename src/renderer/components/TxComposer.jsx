import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useSafe } from '../context/SafeContext';
import styles from './TxComposerSDK.module.css'; // Import the CSS Module

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

  // Use .env keys for predeployed Safe, generated keys otherwise
  const safeAddress = usePredefinedSafe ? import.meta.env.VITE_SAFE_ADDRESS : contextSafeInfo?.address;
  const owner1Key = usePredefinedSafe
    ? import.meta.env.VITE_OWNER1_PK
    : keyPairs?.key1?.privateKey;
  const owner2Key = usePredefinedSafe
    ? import.meta.env.VITE_OWNER2_PK
    : keyPairs?.key2?.privateKey;
  // const serverKey = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";
  
  const [formData, setFormData] = useState({
    to: '',
    value: '0.00001', // Default to 0.00001 ETH for testing
    data: '0x'
  });
  const [txData, setTxData] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [createStatus, setCreateStatus] = useState('');
  const [createError, setCreateError] = useState('');
  const [signStatus, setSignStatus] = useState('');
  const [signError, setSignError] = useState('');
  const [executeStatus, setExecuteStatus] = useState('');
  const [executeError, setExecuteError] = useState('');
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [serverKey, setServerKey] = useState(null);

  // Fetch server address from TPM endpoint with fallback
  const fetchServerAddress = async () => {
    try {
      const response = await fetch('http://localhost:8080/address', {
        timeout: 5000 // 5 second timeout
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch server address: ${response.statusText}`);
      }
      const data = await response.json();
      setServerKey(data.address);
  // TPM status is not section-specific, so just ignore for now
    } catch (err) {
      console.warn('TPM server not available, will use fallback signing:', err.message);
      // Set a placeholder - the actual signing will fall back to Owner 2
      setServerKey('TPM_UNAVAILABLE');
  // TPM status is not section-specific, so just ignore for now
    }
  };

  useEffect(() => {
    // Fetch server address on component mount
    fetchServerAddress();
  }, []);

  useEffect(() => {
    if (!safeAddress || !owner1Key || !owner2Key || !serverKey) {
      if (safeAddress && owner1Key && owner2Key && !serverKey) {
        setCreateStatus('Fetching TPM server address...');
        // Set a timeout to show fallback if not resolved in 2 seconds
        setTimeout(() => {
          if (!serverKey) {
            setCreateStatus('⚠️ TPM server unavailable, using fallback address: 0x70839DfD37Ab4812919FeF52B97c3CD0C41220c9');
          }
        }, 5000);
      } else if (!safeAddress || !owner1Key || !owner2Key) {
        setCreateError('Missing required keys or Safe address');
      }
      return;
    }

    import('../services/safe-sdk.service.js').then(service => {
      try {
        // Only set server key if TPM is actually available
        const actualServerKey = serverKey === 'TPM_UNAVAILABLE' ? null : serverKey;
        service.setKeys(owner1Key, owner2Key, actualServerKey);
        service.setSafeAddress(safeAddress);
        loadSafeInfo();
      } catch (err) {
        setError(`Failed to initialize: ${err.message}`);
      }
    });
  }, [owner1Key, owner2Key, serverKey, safeAddress]);

  const loadSafeInfo = async () => {
    setLoading(true);
    try {
      if (!safeAddress) throw new Error('Safe address not provided');
      
      const provider = new ethers.providers.JsonRpcProvider(import.meta.env.VITE_RPC_URL);
      const safeBalance = await provider.getBalance(safeAddress);
      setBalance(ethers.utils.formatEther(safeBalance));

      if (!owner1Key || !owner2Key) throw new Error('Owner keys not provided');
      
      const info = await getSafeInfo();
      setSafeInfo(info);
    } catch (err) {
      setError(`Failed to load Safe: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    setCreateError('');
    setCreateStatus('Creating transaction...');
    setSignatures([]);
    setSignStatus('');
    setSignError('');
    setExecuteStatus('');
    setExecuteError('');
    try {
      if (!formData.value || formData.value === "0" || parseFloat(formData.value) === 0) {
        throw new Error("Cannot send 0 ETH. Please enter a value greater than 0.");
      }
      let valueInWei;
      try {
        if (formData.value.length > 15) {
          valueInWei = formData.value;
        } else {
          valueInWei = ethers.utils.parseEther(formData.value).toString();
        }
        if (valueInWei === "0") {
          throw new Error("Calculated value is 0 wei. Please enter a larger amount.");
        }
      } catch (e) {
        throw new Error(`Invalid value format: ${formData.value}. ${e.message}`);
      }
      const result = await createSafeTx({
        to: formData.to,
        value: valueInWei,
        data: formData.data
      });
      setTxData(result);
      setCreateStatus('✅ Transaction created! Ready for signing.');
    } catch (err) {
      setCreateError(`Failed to create: ${err.message}`);
      setCreateStatus('');
    }
    setLoading(false);
  };
  const getTPMSignature = async (safeTxHash) => {
    // Check if TPM server is available
    if (serverKey === 'TPM_UNAVAILABLE') {
      throw new Error('TPM server is not available');
    }
    
    try {
      const response = await fetch('http://localhost:8080/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          txHashHex: safeTxHash
        }),
        timeout: 10000 // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`TPM signing failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      return '0x' + result.signatureWithV; // Add 0x prefix
    } catch (err) {
      console.error('TPM signing error:', err);
      throw new Error(`Failed to get TPM signature: ${err.message}`);
    }
  };
  const handleSignBoth = async () => {
    setLoading(true);
    setSignError('');
    setSignStatus('Getting signatures...');
    setExecuteStatus('');
    setExecuteError('');
    try {
      if (!txData) throw new Error('No transaction data');
      const sigs = [];
      setSignStatus('Getting signature from Owner 1...');
      const owner1Sig = await getOwner1Signature(txData.safeTxHash);
      sigs.push(owner1Sig);
      // If we're using a predeployed Safe, prefer Owner 2 signing instead of TPM
      if (usePredefinedSafe) {
        setSignStatus('Using Owner 2 for signing (predeployed Safe)');
        const owner2Sig = await getOwner2Signature(txData.safeTxHash);
        console.log('Owner 2 Signature (predeployed):', owner2Sig);
        sigs.push(owner2Sig);
        setSignStatus('✅ Using Owner 2 signature');
      } else {
        try {
          const tpmSig = await getTPMSignature(txData.safeTxHash);
          console.log('TPM Signature:', tpmSig);
          sigs.push(tpmSig);
          setSignStatus('✅ Using TPM signature');
        } catch (tpmError) {
          setSignStatus('⚠️ TPM unavailable, getting signature from Owner 2...');
          const owner2Sig = await getOwner2Signature(txData.safeTxHash);
          console.log('Owner 2 Signature (fallback):', owner2Sig);
          sigs.push(owner2Sig);
          setSignStatus('✅ Using Owner 2 signature (TPM fallback)');
        }
      }
      const { ethers } = await import('ethers');
      const sigPairs = [];
      for (let i = 0; i < sigs.length; i++) {
        const signerAddress = ethers.utils.recoverAddress(txData.safeTxHash, sigs[i]);
        sigPairs.push({ address: signerAddress, signature: sigs[i] });
      }
      sigPairs.sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()));
      const sortedSignatures = sigPairs.map(pair => pair.signature);
      setSignatures(sortedSignatures);
      setSignStatus(`✅ Got ${sigs.length} signatures! Ready to execute.`);
    } catch (err) {
      setSignError(`Failed to sign: ${err.message}`);
      setSignStatus('');
    }
    setLoading(false);
  };

  const handleExecute = async () => {
    setLoading(true);
    setExecuteError('');
    setExecuteStatus('Executing transaction...');
    try {
      if (!signatures.every(sig => typeof sig === 'string' && sig.startsWith('0x') && sig.length >= 132)) {
        setExecuteError('At least one signature is invalid. Please collect both signatures again.');
        setExecuteStatus('');
        setLoading(false);
        return;
      }
      if (!txData || signatures.length === 0) {
        throw new Error('Missing transaction data or signatures');
      }
      const result = await exeTxn(
        txData.safeTransactionData,
        signatures,
        txData.safeTxHash
      );
      const explorerLink = `${SEPOLIA_EXPLORER}/tx/${result.txHash}`;
      setExecuteStatus(`
✅ Transaction executed! 
Transaction Hash: ${result.txHash}

View on Sepolia Explorer:
${explorerLink}

Transaction Complete`);
      setTimeout(() => loadSafeInfo(), 2000); // Refresh balance after a delay
    } catch (err) {
      setExecuteError(`Failed to execute: ${err.message}`);
      setExecuteStatus('');
    }
    setLoading(false);
  };

  const handleReset = () => {
    setFormData({ to: '', value: '0.00001', data: '0x' });
    setTxData(null);
    setSignatures([]);
    setCreateStatus('');
    setCreateError('');
    setSignStatus('');
    setSignError('');
    setExecuteStatus('');
    setExecuteError('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.navigation}>
        <button 
          className={styles.backButton} 
          onClick={() => onNavigate('safe-setup')}
        >
          ← Back to Safe Setup
        </button>
      </div>

      <h1 className={styles.title}>Transaction Composer</h1>

      {/* --- Safe Info Header Card --- */}
      {safeAddress && (
        <div className={styles.headerCard}>
          <div className={styles.addressBox}>
            <p><strong>Safe Address:</strong> {safeAddress}</p>
            <a 
              href={`${SEPOLIA_EXPLORER}/address/${safeAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.viewLink}
            >
              View on Etherscan ↗
            </a>
          </div>
          
          <div className={styles.balanceBox}>
            <strong>Balance:</strong> {balance !== null ? `${balance} ETH` : 'Loading...'}
            <button 
              className={styles.refreshButton} 
              onClick={loadSafeInfo}
              title="Refresh Balance"
              disabled={loading}
            >
              🔄
            </button>
          </div>

          {safeInfo && (
            <div className={styles.safeDetails}>
              <p><strong>Threshold:</strong> {safeInfo.threshold} of {safeInfo.owners.length}</p>
              <p><strong>Current Nonce:</strong> {safeInfo.nonce}</p>
              <p><strong>Deployed:</strong> {safeInfo.isDeployed ? '✅ Yes' : '❌ No'}</p>
              <details className={styles.ownerDetails}>
                <summary>Show Owners ({safeInfo.owners.length})</summary>
                <ul>
                  {safeInfo.owners.map((owner, i) => (
                    <li key={i}>{owner}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>
      )}

      {/* --- Step 1: Create --- */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.stepNumber}>1</span>
          Compose Transaction
        </h2>
        <div className={styles.formGroup}>
          <label htmlFor="toAddress">To Address</label>
          <input
            id="toAddress"
            className={styles.input}
            placeholder="Recipient address (0x...)"
            value={formData.to}
            onChange={(e) => setFormData({ ...formData, to: e.target.value })}
            disabled={loading}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="value">Value (ETH)</label>
          <input
            id="value"
            className={styles.input}
            placeholder="Value in ETH (e.g., 0.00001)"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            disabled={loading}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="data">Data (Optional)</label>
          <input
            id="data"
            className={styles.input}
            placeholder="0x (for simple ETH transfer)"
            value={formData.data}
            onChange={(e) => setFormData({ ...formData, data: e.target.value })}
            disabled={loading}
          />
        </div>
        {/* Section-specific status/error for Create */}
        {createStatus && <div className={styles.status}>{createStatus}</div>}
        {createError && <div className={styles.error}>{createError}</div>}
        <button 
          className={`${styles.button} ${styles.btnPrimary}`} 
          onClick={handleCreate}
          disabled={loading || !formData.to || !formData.value || !!txData}
        >
          {loading && !txData ? 'Creating...' : 'Create Transaction'}
        </button>
      </div>

      {/* --- Step 2: Sign --- */}
      {txData && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.stepNumber}>2</span>
            Collect Signatures
          </h2>
          <div className={styles.txInfo}>
            <p><strong>SafeTxHash:</strong> <code>{txData.safeTxHash}</code></p>
            <p><strong>Nonce:</strong> {txData.safeTransactionData.nonce}</p>
          </div>
          {/* Section-specific status/error for Sign */}
          {signStatus && <div className={styles.status}>{signStatus}</div>}
          {signError && <div className={styles.error}>{signError}</div>}
          <button 
            className={`${styles.button} ${styles.btnSuccess}`}
            onClick={handleSignBoth}
            disabled={signatures.length > 0 || loading || !txData}
          >
            {loading && signatures.length === 0 ? 'Signing...' : (signatures.length > 0 ? '✅ Signatures Collected' : 'Get Signatures (Owner1 + Owner2)')}
          </button>
          {signatures.length > 0 && (
            <div className={styles.signaturesBox}>
              <p><strong>Signatures collected: {signatures.length}</strong></p>
              {signatures.map((sig, i) => (
                <p key={i} className={styles.sigItem}>
                  Sig {i + 1}: {sig.substring(0, 20)}...{sig.substring(sig.length - 20)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Step 3: Execute --- */}
      {txData && signatures.length >= 2 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.stepNumber}>3</span>
            Execute Transaction
          </h2>
          <p>Ready to execute with {signatures.length} signatures.</p>
          {/* Section-specific status/error for Execute */}
          {executeStatus && <div className={styles.status}>{executeStatus}</div>}
          {executeError && <div className={styles.error}>{executeError}</div>}
          <button 
            className={`${styles.button} ${styles.btnPrimary}`} 
            onClick={handleExecute}
            disabled={loading || signatures.length < 2}
          >
            {loading ? 'Executing...' : 'Execute Transaction On-Chain'}
          </button>
        </div>
      )}

      {/* --- Actions & Navigation --- */}
      <div className={styles.actionsFooter}>
        {(txData || createStatus || createError || signStatus || signError || executeStatus || executeError) && (
          <button 
            className={`${styles.button} ${styles.btnDanger}`} 
            onClick={handleReset}
            disabled={loading}
          >
            Reset / New Transaction
          </button>
        )}

        {onNavigate && (
          <button
            className={`${styles.button} ${styles.btnSecondary}`}
            onClick={() => onNavigate('hyperindex')}
          >
            Open HyperIndex Activity
          </button>
        )}
      </div>
    </div>
  );
}