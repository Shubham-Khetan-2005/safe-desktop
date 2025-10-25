/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
const {
 Safe,
} = require("../generated");

Safe.AddedOwner.handler(async ({event, context}) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    owner: event.params.owner,
    prevOwner: event.params.prevOwner,
    threshold: event.params.threshold,
    timestamp: event.block.timestamp,
    safeAddress: event.srcAddress.toLowerCase(),
  };

  context.Safe_AddedOwner.set(entity);
});


Safe.ApproveHash.handler(async ({event, context}) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    msgHash: event.params.msgHash,
    payment: event.params.payment,
    timestamp: event.block.timestamp,
    safeAddress: event.srcAddress.toLowerCase(),
  };

  context.Safe_ApproveHash.set(entity);
});


Safe.ChangedThreshold.handler(async ({event, context}) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    threshold: event.params.threshold,
    timestamp: event.block.timestamp,
    safeAddress: event.srcAddress.toLowerCase(),
  };

  context.Safe_ChangedThreshold.set(entity);
});


Safe.DisabledModule.handler(async ({event, context}) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    module: event.params.module,
    timestamp: event.block.timestamp,
    safeAddress: event.srcAddress.toLowerCase(),
  };

  context.Safe_DisabledModule.set(entity);
});


Safe.EnabledModule.handler(async ({event, context}) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    module: event.params.module,
    timestamp: event.block.timestamp,
    safeAddress: event.srcAddress.toLowerCase(),
  };

  context.Safe_EnabledModule.set(entity);
});


Safe.ExecutionFailure.handler(async ({event, context}) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    txHash: event.params.txHash,
    payment: event.params.payment,
    timestamp: event.block.timestamp,
    safeAddress: event.srcAddress.toLowerCase(),
  };

  context.Safe_ExecutionFailure.set(entity);
});


Safe.ExecutionSuccess.handler(async ({event, context}) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    txHash: event.params.txHash,
    payment: event.params.payment,
    timestamp: event.block.timestamp,
    safeAddress: event.srcAddress.toLowerCase(),
  };

  context.Safe_ExecutionSuccess.set(entity);
});


Safe.FallbackHandlerChanged.handler(async ({event, context}) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    oldFallbackHandler: event.params.oldFallbackHandler,
    newFallbackHandler: event.params.newFallbackHandler,
    timestamp: event.block.timestamp,
    safeAddress: event.srcAddress.toLowerCase(),

  };

  context.Safe_FallbackHandlerChanged.set(entity);
});


Safe.RemovedOwner.handler(async ({event, context}) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    owner: event.params.owner,
    prevOwner: event.params.prevOwner,
    threshold: event.params.threshold,
    timestamp: event.block.timestamp,
    safeAddress: event.srcAddress.toLowerCase(),

  };

  context.Safe_RemovedOwner.set(entity);
});


Safe.SafeMultiSigTransaction.handler(async ({event, context}) => {
  let safeAddress = "";
  if (event.srcAddress && typeof event.srcAddress === "string") {
    safeAddress = event.srcAddress.toLowerCase();
  } else {
    // Log and skip or handle gracefully
    console.error("[SafeMultiSigTransaction] Missing event.srcAddress", event);
    return;
  }
  const txHash = event.params.txHash || "";
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    to: event.params.to,
    value: event.params.value,
    data: event.params.data,
    operation: event.params.operation,
    safeTxGas: event.params.safeTxGas,
    baseGas: event.params.baseGas,
    gasPrice: event.params.gasPrice,
    gasToken: event.params.gasToken,
    refundReceiver: event.params.refundReceiver,
    signatures: event.params.signatures,
    additionalInfo: event.params.additionalInfo,
    timestamp: event.block.timestamp,
    safeAddress, // now is always a string, or handler exits
    txHash,
  };

  context.Safe_SafeMultiSigTransaction.set(entity);
});


// Safe.SafeMultiSigTransaction.handler(async ({event, context}) => {
//   let safeAddress = "";
//   if (event.srcAddress && typeof event.srcAddress === "string") {
//     safeAddress = event.srcAddress.toLowerCase();
//   } else {
//     // Log and skip or handle gracefully
//     console.error("[SafeMultiSigTransaction] Missing event.srcAddress", event);
//     return;
//   }
//   const txHash = event.txHash || event.transactionHash || event.transaction?.hash || "";
//   const entity = {
//     id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
//     txHash,
//     to: event.params.to,
//     value: event.params.value,
//     data: event.params.data,
//     operation: event.params.operation,
//     safeTxGas: event.params.safeTxGas,
//     baseGas: event.params.baseGas,
//     gasPrice: event.params.gasPrice,
//     gasToken: event.params.gasToken,
//     refundReceiver: event.params.refundReceiver,
//     signatures: event.params.signatures,
//     additionalInfo: event.params.additionalInfo,
//     timestamp: event.block.timestamp,
//     safeAddress, // now is always a string, or handler exits
//     txHash,
//   };

//   context.Safe_SafeMultiSigTransaction.set(entity);
// });


