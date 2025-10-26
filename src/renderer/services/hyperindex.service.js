export const HYPERINDEX_URL = "https://indexer.dev.hyperindex.xyz/1fed960/v1/graphql"; // Change if needed


async function gql(query, variables = {}) {
  const res = await fetch(HYPERINDEX_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }) // include variables
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

export async function fetchLatestExecutions(limit) {
  // make sure limit is an integer:
  limit = Number.isInteger(limit) ? limit : 10;
  const q = `
    query LatestExecs($limit: Int!) {
      Safe_ExecutionSuccess(
        order_by: { id: desc }
        limit: $limit
      ) {
        id
        txHash
        payment
      }
    }
  `;
  const data = await gql(q, { limit });
  return data.Safe_ExecutionSuccess ?? [];
}

export async function fetchLatestMultiSigTx(limit) {
  limit = Number.isInteger(limit) ? limit : 10;
  const q = `
    query LatestMultiSigTx($limit: Int!) {
      Safe_SafeMultiSigTransaction(
        order_by: { id: desc }
        limit: $limit
      ) {
        id
        to
        value
        data
        operation
        safeTxGas
        baseGas
        gasPrice
        gasToken
        refundReceiver
        signatures
        additionalInfo
      }
    }
  `;
  const data = await gql(q, { limit });
  return data.Safe_SafeMultiSigTransaction ?? [];
}

export async function fetchSafeOverviewData(safeAddress) {
  const q = `
    query SafeDashboard($safeAddress: String!, $limit: Int!) {
  txs: Safe_SafeMultiSigTransaction(where: {safeAddress: {_eq: $safeAddress}}, limit: $limit) {
    id
  }
  executed: Safe_ExecutionSuccess(where: {safeAddress: {_eq: $safeAddress}}, order_by: {timestamp: desc}, limit: $limit) {
    id
    timestamp
  }
  failed: Safe_ExecutionFailure(where: {safeAddress: {_eq: $safeAddress}}, limit: $limit) {
    id
  }
  owners: Safe_AddedOwner(where: {safeAddress: {_eq: $safeAddress}}, order_by: {timestamp: desc}, limit: 5) {
    owner
  }
  lastOwnerChange: Safe_ChangedThreshold(where: {safeAddress: {_eq: $safeAddress}}, order_by: {timestamp: desc}, limit: 1) {
    timestamp
  }
}

  `;

  const variables = { safeAddress: safeAddress.toLowerCase(), limit: 50 };
  const res = await gql(q, variables);

  return {
    totalTxs: res.txs.length,
    executedTxs: res.executed.length,
    pendingTxs: res.txs.length - res.executed.length - res.failed.length,
    failedTxs: res.failed.length,
    owners: res.owners.map(o => o.owner),
    threshold: res.lastOwnerChange.length > 0 ? "Changed" : "Unknown",
    lastTxTime: res.executed.length > 0 ? res.executed[0].timestamp : null,
  };
}


export async function fetchTxLifecycleData(safeAddress) {
  const q = `
    query TxLifecycle($safeAddress: String!) {
      txs: Safe_SafeMultiSigTransaction(
        where: {safeAddress: {_eq: $safeAddress}}, 
        order_by: {timestamp: desc}
      ) {
        id
        to
        value
        timestamp
      }
      executedIds: Safe_ExecutionSuccess(
        where: {safeAddress: {_eq: $safeAddress}}
      ) {
        timestamp
      }
      failedIds: Safe_ExecutionFailure(
        where: {safeAddress: {_eq: $safeAddress}}
      ) {
        timestamp
      }
    }
  `;
  const variables = { safeAddress: safeAddress.toLowerCase() };
  const res = await gql(q, variables);

  const executedSet = new Set(res.executedIds.map(e => e.timestamp));
  const failedSet = new Set(res.failedIds.map(f => f.timestamp));

  return res.txs.map(tx => ({
    ...tx,
    status: executedSet.has(tx.timestamp) ? "Executed" : failedSet.has(tx.timestamp) ? "Failed" : "Pending"
  }));
}

export async function fetchRecentActivity(safeAddress, limit = 10) {
  const q = `
    query RecentActivity($safeAddress: String!, $limit: Int!) {
      execSuccess: Safe_ExecutionSuccess(
        where: {safeAddress: {_eq: $safeAddress}}, 
        order_by: {timestamp: desc}, 
        limit: $limit
      ) {
        id
        txHash
        timestamp
      }
      execFailure: Safe_ExecutionFailure(
        where: {safeAddress: {_eq: $safeAddress}}, 
        order_by: {timestamp: desc}, 
        limit: $limit
      ) {
        id
        txHash
        timestamp
      }
      addedOwner: Safe_AddedOwner(
        where: {safeAddress: {_eq: $safeAddress}}, 
        order_by: {timestamp: desc}, 
        limit: $limit
      ) {
        id
        owner
        timestamp
      }
    }
  `;
  
  const variables = { safeAddress: safeAddress.toLowerCase(), limit };
  const res = await gql(q, variables);
  
  // Combine and sort all activities
  const activities = [
    ...res.execSuccess.map(e => ({ ...e, type: "ExecutionSuccess" })),
    ...res.execFailure.map(e => ({ ...e, type: "ExecutionFailure" })),
    ...res.addedOwner.map(e => ({ ...e, type: "AddedOwner" }))
  ];
  
  activities.sort((a, b) => b.timestamp - a.timestamp);
  
  return activities.slice(0, limit);
}
