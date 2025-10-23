import express from 'express';
import {
  getSafeInfoHandler,
  createTxHandler,
  signTxHandler,
  generateKeyPairHandler
} from '../controllers/safe-sdk.controller.js';

const router = express.Router();

// GET /safe/info - Get Safe information
router.get('/info', getSafeInfoHandler);

// POST /safe/create - Create Safe transaction
router.post('/create', createTxHandler);

// POST /safe/sign - Sign transaction hash with server key
router.post('/sign', signTxHandler);

// POST /safe/execute - Execute transaction with signatures
// router.post('/execute', executeTxHandler);

// POST /safe/submit - Legacy combined endpoint
// router.post('/submit', submitTxHandler);

router.post('/generate-keypair', generateKeyPairHandler);


export default router;
