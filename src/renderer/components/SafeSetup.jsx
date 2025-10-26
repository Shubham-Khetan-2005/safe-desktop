import React, { useState } from 'react';
import { ethers } from 'ethers';
import Safe from '@safe-global/protocol-kit';
import TxComposerSDK from './TxComposer.jsx';
import { useSafe } from '../context/SafeContext';

// Import the new CSS Module file
import styles from './SafeSetup.module.css'; 

const RPC_URL = import.meta.env.VITE_RPC_URL;
const CHAIN_ID = BigInt(import.meta.env.VITE_CHAIN_ID || 11155111);
const SERVER_URL = 'http://localhost:3000';

const PREDEFINED_SAFE = import.meta.env.VITE_SAFE_ADDRESS;
const HIDDEN_TEXT = '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••';

export default function SafeSetup({ onNavigate }) {
  const { 
    keyPairs, setKeyPairs,
    safeInfo, setSafeInfo,
    serverPublicKey, setServerPublicKey,
    usePredefinedSafe, setUsePredefinedSafe
  } = useSafe();
  
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [checkedBalance, setCheckedBalance] = useState(false);
  const [fetchedServerKey, setFetchedServerKey] = useState(null);

  // --- NEW: State for showing/hiding keys ---
  const [showKey1Pk, setShowKey1Pk] = useState(false);
  const [showKey1Mn, setShowKey1Mn] = useState(false);
  const [showKey2Pk, setShowKey2Pk] = useState(false);
  const [showKey2Mn, setShowKey2Mn] = useState(false);

  const saveKeyAndAddressToFile = (privateKey, safeAddress) => {
    try {
      const content = `Private Key (Key 1):\n${privateKey}\n\nSafe Address:\n${safeAddress}\n`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'safe-key-and-address.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to save file:', e);
    }
  };


  const handleGenerateTwoKeys = () => {
    try {
      setUsePredefinedSafe(false); // Reset to dynamic Safe mode
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

      // --- NEW: Reset visibility on generation ---
      setShowKey1Pk(false);
      setShowKey1Mn(false);
      setShowKey2Pk(false);
      setShowKey2Mn(false);

      setStatus('✅ Generated two keypairs. Please SAVE the private key of Key 1 securely!');
      setError('');
    } catch (err) {
      setError('❌ Failed to generate key pairs: ' + err.message);
      setStatus('');
    }
  };

  // Fetch server public key from TPM endpoint with fallback
  const handleGetServerPublicKey = async () => {
    try {
      setError('');
      setStatus('Fetching server public key from TPM...');
      
      const response = await fetch('http://localhost:8080/address', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch server address: ${response.statusText}`);
      }
      
      const data = await response.json();
      const serverAddress = data.address;
      
      setServerPublicKey(serverAddress);
      setFetchedServerKey(serverAddress);
      setStatus(`✅ Server public key fetched: ${serverAddress}\nNote: This key is managed by the TPM server`);
    } catch (err) {
      const fallbackAddress = "0x70839DfD37Ab4812919FeF52B97c3CD0C41220c9";
      
      setServerPublicKey(fallbackAddress);
      setFetchedServerKey(fallbackAddress);
      setStatus(`⚠️ TPM server unavailable, using fallback address: ${fallbackAddress}\nNote: This is a fallback key for testing when TPM server is offline`);
      setError(''); // Clear error since we have a fallback
    }
  };

  const handleDeploySafe = async () => {
    if (!keyPairs || !serverPublicKey || !fetchedServerKey) {
      setError('Please generate keys and get server public key first.');
      return;
    }
    try {
      setStatus('⏳ Deploying Safe contract...');
      setError('');

      const owners = [
        keyPairs.key1.address,
        keyPairs.key2.address,
        fetchedServerKey, // Use the dynamically fetched server key
      ];
      const threshold = 2;

      const signer = keyPairs.key1.privateKey;
      const protocolKit = await Safe.init({
        provider: RPC_URL,
        signer,
        predictedSafe: {
          safeAccountConfig: { owners, threshold }
        },
        chainId: CHAIN_ID
      });

      const predictedAddress = await protocolKit.getAddress();
      const wallet = new ethers.Wallet(keyPairs.key1.privateKey, new ethers.providers.JsonRpcProvider(RPC_URL));
      const deploymentTx = await protocolKit.createSafeDeploymentTransaction();
      const balance = await wallet.getBalance();
      if (balance.isZero() || balance.lt(estimatedTotalCost)) {
        const faucetLinks = `
          • Alchemy Sepolia Faucet: https://sepoliafaucet.com/
          • Sepolia PoW Faucet: https://sepolia-faucet.pk910.de/
          • Infura Sepolia Faucet: https://faucet.sepolia.dev/
        `;
        throw new Error(`Account ${wallet.address} has insufficient ETH to deploy the Safe.\n\nYou need at least ${ethers.utils.formatEther(estimatedTotalCost)} ETH (estimated) for deployment.\n\nCurrent balance: ${ethers.utils.formatEther(balance)} ETH.\n\nPlease fund this address with Sepolia ETH first.\n\nYou can get test ETH from these faucets:\n${faucetLinks}`);
      }

      const txResponse = await wallet.sendTransaction({
        to: deploymentTx.to,
        data: deploymentTx.data,
        value: deploymentTx.value || '0',
        gasLimit: 1000000, 
        maxFeePerGas: ethers.utils.parseUnits('20', 'gwei'), 
        maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei'),
        type: 2 
      });

      setStatus('⏳ Waiting for deployment transaction to be mined...');
      await txResponse.wait();

      // Immediately set Safe info and show composer, and start funding in background
      const newSafeInfo = { address: predictedAddress, privateKey: keyPairs.key1.privateKey };
      setSafeInfo(newSafeInfo);
      setStatus('✅ Safe deployed! Funding Safe in background...');
      setShowComposer(true);
      setError('');
      saveKeyAndAddressToFile(keyPairs.key1.privateKey, predictedAddress);

      // --- Auto-fund the Safe in the background ---
      (async () => {
        try {
          // Re-fetch balance after deployment (since deployment cost gas)
          const postDeployBalance = await wallet.getBalance();
          const provider = wallet.provider;
          const gasPrice = await provider.getGasPrice();
          // Step 1: Estimate gas with value = 0
          const gasLimit = await provider.estimateGas({
            to: predictedAddress,
            from: wallet.address,
            value: 0
          });
          // Step 2: Calculate max sendable value with safety buffer
          const gasCost = gasLimit.mul(gasPrice);
          const safetyBuffer = ethers.utils.parseEther('0.0001'); // 0.0001 ETH buffer
          let fundAmount = postDeployBalance.sub(gasCost).sub(safetyBuffer);
          if (fundAmount.lte(0)) {
            setStatus(`✅ Safe deployed at: ${predictedAddress} (⚠️ Not enough ETH left to fund Safe after gas and buffer)`);
          } else {
            // Step 3: Send max value with estimated gas and buffer
            const fundTx = await wallet.sendTransaction({
              to: predictedAddress,
              value: fundAmount,
              gasLimit,
              gasPrice
            });
            await fundTx.wait();
            setStatus(`✅ Safe deployed and maximally funded at: ${predictedAddress}`);
          }
        } catch (fundErr) {
          setStatus(`✅ Safe deployed at: ${predictedAddress} (⚠️ Auto-funding failed: ${fundErr.message})`);
        }
      })();
    } catch (err) {
      setError(`❌ ${err.message}`);
      setStatus('');
    }
  };

  if (showComposer && (safeInfo || (usePredefinedSafe && PREDEFINED_SAFE))) {
    const safeToUse = usePredefinedSafe ? PREDEFINED_SAFE : safeInfo.address;
    const owner1KeyToUse = keyPairs?.key1?.privateKey || '';
    const owner2KeyToUse = keyPairs?.key2?.privateKey || '';
    return (
      <TxComposerSDK
        safeAddress={safeToUse}
        owner1Key={owner1KeyToUse}
        owner2Key={owner2KeyToUse}
        onNavigate={(page) => {
          if (page === 'safe-setup') {
            setShowComposer(false);
            if (onNavigate) onNavigate('safe-setup');
          } else if (onNavigate) {
            onNavigate(page);
          }
        }}
      />
    );
  }

  const checkBalance = async () => {
    if (!keyPairs) {
      setError('❌ Please generate keys first');
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
        setStatus(`✅ Current balance: ${balanceInEth} ETH\nYou have enough ETH to proceed!`);
      }
    } catch (err) {
      setError('❌ Failed to check balance: ' + err.message);
    }
  };

  const handleGetTestEth = () => {
    if (!keyPairs) {
      setError('❌ Please generate keys first');
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
    <div className={styles.container}>
      <h1 className={styles.title}>Safe 2-of-3 Multisig Setup</h1>

      {/* Quick Start Option remains at the top if needed */}
      {!usePredefinedSafe && !safeInfo && PREDEFINED_SAFE && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            🚀 Quick Start Option
          </h2>
          <p>Use an existing pre-deployed Safe to start testing immediately:</p>
          <button 
            className={`${styles.button} ${styles.btnPurple}`}
            onClick={() => {
              setUsePredefinedSafe(true);
              setShowComposer(true);
            }}
          >
            Use Pre-deployed Safe ({PREDEFINED_SAFE.substring(0, 6)}...{PREDEFINED_SAFE.substring(38)})
          </button>
          <p className={styles.note}>Or continue below to deploy your own Safe</p>
        </div>
      )}

      {/* Section 1: Key Generation status/error */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.stepNumber}>1</span>
          Generate 2 Local Key Pairs
        </h2>
        <button className={`${styles.button} ${styles.btnGreen}`} onClick={handleGenerateTwoKeys}>
          Generate Keys
        </button>
        {status && status.includes('keypair') && (
          <div className={styles.sectionStatus}>{status}</div>
        )}
        {error && error.toLowerCase().includes('key pair') && (
          <div className={styles.sectionError}>{error}</div>
        )}
        {keyPairs && (
          <>
            <div className={`${styles.infoBox} ${styles.warning}`}>
              <h3>Key 1 (Save privately!)</h3>
              <div className={styles.keyItem}>
                <div className={styles.keyHeader}>
                  <label>Address</label>
                  {/* No show/hide for public address */}
                </div>
                <code className={styles.code}>{keyPairs.key1.address}</code>
              </div>
              <div className={styles.keyItem}>
                <div className={styles.keyHeader}>
                  <label>Private Key</label>
                  <button className={styles.showButton} onClick={() => setShowKey1Pk(!showKey1Pk)}>
                    {showKey1Pk ? 'Hide' : 'Show'}
                  </button>
                </div>
                <code className={`${styles.code} ${!showKey1Pk ? styles.hiddenValue : ''}`}>
                  {showKey1Pk ? keyPairs.key1.privateKey : HIDDEN_TEXT}
                </code>
              </div>
              <div className={styles.keyItem}>
                <div className={styles.keyHeader}>
                  <label>Mnemonic</label>
                  <button className={styles.showButton} onClick={() => setShowKey1Mn(!showKey1Mn)}>
                    {showKey1Mn ? 'Hide' : 'Show'}
                  </button>
                </div>
                <code className={`${styles.code} ${!showKey1Mn ? styles.hiddenValue : ''}`}>
                  {showKey1Mn ? keyPairs.key1.mnemonic : HIDDEN_TEXT}
                </code>
              </div>

              <h3>Key 2 (For App Use)</h3>
              <div className={styles.keyItem}>
                <div className={styles.keyHeader}>
                  <label>Address</label>
                </div>
                <code className={styles.code}>{keyPairs.key2.address}</code>
              </div>
              <div className={styles.keyItem}>
                <div className={styles.keyHeader}>
                  <label>Private Key</label>
                  <button className={styles.showButton} onClick={() => setShowKey2Pk(!showKey2Pk)}>
                    {showKey2Pk ? 'Hide' : 'Show'}
                  </button>
                </div>
                <code className={`${styles.code} ${!showKey2Pk ? styles.hiddenValue : ''}`}>
                  {showKey2Pk ? keyPairs.key2.privateKey : HIDDEN_TEXT}
                </code>
              </div>
              {/* --- NEW: Mnemonic for Key 2 --- */}
              <div className={styles.keyItem}>
                <div className={styles.keyHeader}>
                  <label>Mnemonic</label>
                  <button className={styles.showButton} onClick={() => setShowKey2Mn(!showKey2Mn)}>
                    {showKey2Mn ? 'Hide' : 'Show'}
                  </button>
                </div>
                <code className={`${styles.code} ${!showKey2Mn ? styles.hiddenValue : ''}`}>
                  {showKey2Mn ? keyPairs.key2.mnemonic : HIDDEN_TEXT}
                </code>
              </div>
            </div>
            {!usePredefinedSafe && (
              <div className={`${styles.infoBox} ${styles.info}`}>
                <h3>Get Sepolia Test ETH</h3>
                <p>You need some test ETH (for <strong>Key 1</strong>) to deploy your Safe.</p>
                <div className={styles.buttonGroup}>
                  <button className={`${styles.button} ${styles.btnOrange}`} onClick={handleGetTestEth}>
                    Get Test ETH
                  </button>
                  <button className={`${styles.button} ${styles.btnBlue}`} onClick={checkBalance}>
                    Check Balance
                  </button>
                </div>
                {status && status.toLowerCase().includes('balance') && (
                  <div className={styles.sectionStatus}>{status}</div>
                )}
                {error && error.toLowerCase().includes('balance') && (
                  <div className={styles.sectionError}>{error}</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Section 2: Server Key status/error */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.stepNumber}>2</span>
          Get Server Public Key
        </h2>
        <p>Request the server's public key. The server will generate and securely store its private key.</p>
        <button className={`${styles.button} ${styles.btnGreen}`} onClick={handleGetServerPublicKey}>
          Request Server Key
        </button>
        {status && (status.toLowerCase().includes('server public key') || status.toLowerCase().includes('tpm server')) && (
          <div className={styles.sectionStatus}>{status}</div>
        )}
        {error && error.toLowerCase().includes('server') && (
          <div className={styles.sectionError}>{error}</div>
        )}
        {serverPublicKey && (
          <div className={`${styles.infoBox} ${styles.success}`}>
            <p><strong>Server Public Key:</strong></p>
            <code className={styles.code}>{serverPublicKey}</code>
            <p className={styles.note}>Note: The server securely manages its own private key.</p>
          </div>
        )}
      </div>

      {/* Section 3: Deploy Safe status/error */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.stepNumber}>3</span>
          Deploy Safe Contract
        </h2>
        <button 
          className={`${styles.button} ${styles.btnBlue}`} 
          onClick={handleDeploySafe}
          disabled={!keyPairs || !serverPublicKey}
        >
          Deploy Safe
        </button>
        {status && (status.toLowerCase().includes('deploying') || status.toLowerCase().includes('waiting for deployment') || status.toLowerCase().includes('funding safe') || status.toLowerCase().includes('deployed')) && (
          <div className={styles.sectionStatus}>{status}</div>
        )}
        {error && error.toLowerCase().includes('deploy') && (
          <div className={styles.sectionError}>{error}</div>
        )}
      </div>

      {/* Next Steps section remains unchanged */}
      {safeInfo && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            🎉 Next Steps
          </h2>
          <p>Your new Safe is deployed! You can now proceed to the transaction composer.</p>
          <p><strong>Safe Address:</strong></p>
          <code className={styles.code}>{safeInfo.address}</code>
          <button
            className={`${styles.button} ${styles.btnPurple}`}
            onClick={() => setShowComposer(true)}
          >
            Open Transaction Composer
          </button>
        </div>
      )}
    </div>
  );
}