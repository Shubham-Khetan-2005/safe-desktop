import 'dotenv/config';
import { ethers } from 'ethers';
import {
  createSafeTransaction,
  signTransactionHash,
  getSafeInfo
} from '../services/safe-sdk.service.js';

const SERVER_SIGNER_PK = process.env.OWNER1_PK || process.env.SERVER_SIGNER_PK;

if (!SERVER_SIGNER_PK) {
  console.warn('⚠️  No OWNER1_PK or SERVER_SIGNER_PK found - some endpoints may fail');
}

export async function getSafeInfoHandler(req, res) {
  try {
    if (!SERVER_SIGNER_PK) {
      return res.status(500).json({
        error: 'SERVER_SIGNER_PK not configured'
      });
    }

    const info = await getSafeInfo(SERVER_SIGNER_PK);
    return res.json(info);
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Failed to get Safe info'
    });
  }
}

export async function createTxHandler(req, res) {
  try {
    const { to, value, data } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Missing required field: "to"' });
    }
    if (!ethers.utils.isAddress(to)) {
      return res.status(400).json({ error: 'Invalid "to" address format' });
    }
    if (!SERVER_SIGNER_PK) {
      return res.status(500).json({ error: 'SERVER_SIGNER_PK not configured' });
    }

    const result = await createSafeTransaction(
      { to, value: value || '0', data: data || '0x' },
      SERVER_SIGNER_PK
    );

    return res.json({
      safeTxHash: result.safeTxHash,
      safeTransactionData: result.safeTransactionData
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Failed to create Safe transaction'
    });
  }
}

export async function signTxHandler(req, res) {
  console.log('=== SIGN TRANSACTION HANDLER ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  try {
    const { safeTxHash } = req.body;

    if (!safeTxHash) {
      return res.status(400).json({ error: 'Missing safeTxHash' });
    }
    if (!SERVER_SIGNER_PK) {
      return res.status(500).json({ error: 'SERVER_SIGNER_PK not configured' });
    }
    const signature = await signTransactionHash(safeTxHash, SERVER_SIGNER_PK);
    const signerAddress = new ethers.Wallet(SERVER_SIGNER_PK).address;
    return res.json({
      signature,
      signer: signerAddress
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Failed to sign transaction'
    });
  }
}

// export async function executeTxHandler(req, res) {
//   console.log(req);
//   console.log('=== EXECUTE TRANSACTION HANDLER ===');
//   console.log('Request body:', JSON.stringify(req.body, null, 2));
//   try {
//     const { safeTransactionData, signatures, executorPk } = req.body;

//     console.log('Safe transaction data:', safeTransactionData);
//     console.log('Signatures array:', signatures);
//     console.log('Signatures type:', typeof signatures);
//     console.log('Signatures length:', signatures?.length);
//     console.log('Executor PK:', executorPk);

//     if (!safeTransactionData || !Array.isArray(signatures)) {
//       return res.status(400).json({ error: 'Missing safeTransactionData or signatures[]' });
//     }
//     if (signatures.length === 0) {
//       return res.status(400).json({ error: 'No signatures provided' });
//     }
//     const executor = executorPk || process.env.EXECUTOR_PK || SERVER_SIGNER_PK;
//     if (!executor) {
//       return res.status(500).json({ error: 'No executor private key available' });
//     }

//     const sanitizedSignatures = signatures.filter(sig => typeof sig === 'string' && sig.startsWith('0x') && sig.length >= 132);
    
//     console.log('Signatures:', signatures);
//     console.log('Sanitized signatures:', sanitizedSignatures);

//     if (sanitizedSignatures.length < 2) {
//       throw new Error('Invalid signatures: Each must be a 0x-prefixed ECDSA signature');
//     }


//     const result = await executeTransaction(
//       safeTransactionData,
//       sanitizedSignatures,
//       executor
//     );
//     return res.json({
//       status: 'executed',
//       txHash: result.txHash,
//       receipt: result.receipt
//     });
//   } catch (err) {
//     return res.status(500).json({
//       error: err.message || 'Failed to execute transaction'
//     });
//   }
// }

// export async function submitTxHandler(req, res) {
//   try {
//     const { safeTxHash, safeTransactionData, signatures, executeWith } = req.body;
//     if (!safeTxHash || !safeTransactionData || !Array.isArray(signatures)) {
//       return res.status(400).json({
//         error: 'Missing required fields'
//       });
//     }
//     if (executeWith === 'server') {
//       const executorPk = process.env.EXECUTOR_PK || SERVER_SIGNER_PK;
//       if (!executorPk) {
//         return res.status(500).json({ error: 'EXECUTOR_PK not configured' });
//       }
//       const result = await executeTransaction(
//         safeTransactionData,
//         signatures,
//         executorPk
//       );
//       return res.json({
//         status: 'executed',
//         txHash: result.txHash,
//         receipt: result.receipt
//       });
//     }
//     return res.json({
//       status: 'ready',
//       message: 'Signatures validated. Ready for execution via client.',
//       signatureCount: signatures.length
//     });
//   } catch (err) {
//     return res.status(500).json({
//       error: err.message || 'Failed to submit transaction'
//     });
//   }
// }

export async function generateKeyPairHandler(req, res) {
  try {
    console.log('=== GENERATE KEYPAIR HANDLER ===');
    
    // Generate a new random wallet (this will be stored in TPM/secure storage in production)
    const newWallet = ethers.Wallet.createRandom();
    
    const publicKey = newWallet.address;
    const privateKey = newWallet.privateKey;
    
    // TODO: In production, store privateKey in TPM/Hardware Security Module
    // For now, we'll store it in a secure server location
    console.log(`Generated keypair. Public: ${publicKey}`);
    
    // Store mapping (you can use a database in production)
    // For PoC: store in memory or file
    
    return res.json({
      publicKey,
      message: 'Keypair generated. Private key stored securely on server.'
    });
  } catch (err) {
    console.error('Keypair generation error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to generate keypair'
    });
  }
}
