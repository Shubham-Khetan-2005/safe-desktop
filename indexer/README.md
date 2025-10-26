# Safe Desktop - Envio Indexer

 Real-time blockchain data indexing for Safe multi-signature wallets using Envio

## Overview

This Envio indexer provides real-time blockchain data indexing for Safe multi-signature wallets on Ethereum Sepolia testnet. It tracks Safe deployments, transactions, ownership changes, and all Safe-related events to power the Safe Desktop dashboard with comprehensive analytics.

*Please refer to the [documentation website](https://docs.envio.dev) for a thorough guide on all [Envio](https://envio.dev) indexer features*

## What We Index

### Safe Factory Events
- **SafeDeployed**: Tracks new Safe wallet deployments with owners, threshold, and creator information

### Safe Wallet Events
- **ExecutionSuccess/ExecutionFailure**: Transaction execution results
- **AddedOwner/RemovedOwner**: Ownership changes
- **ChangedThreshold**: Signature threshold modifications
- **ApproveHash**: Transaction approvals
- **EnabledModule/DisabledModule**: Safe module management
- **SafeMultiSigTransaction**: Detailed transaction data

### Dynamic Loading Architecture

Our indexer leverages **Envio's Dynamic Contract Registration** to automatically discover and index new Safe contracts as they are deployed. This eliminates the need to manually configure contract addresses and enables real-time indexing of the entire Safe ecosystem.

Factory Address: `0xd673f4d06b43a776fe6284f3473053d519ed620c`
<br>
**Key Features:**
- **Automatic Discovery**: Monitors `SafeDeploymentFactory` for new Safe deployments
- **Zero Configuration**: No need to hardcode Safe contract addresses
- **Real-time Registration**: Newly deployed Safes are indexed immediately
- **Historical Support**: Can retroactively index from any starting block
- **Scalable Architecture**: Handles unlimited Safe deployments without config changes

**How it Works:**
1. Monitor `SafeDeploymentFactory.SafeDeployed` events
2. Extract new Safe contract address from deployment event
3. Dynamically register the Safe contract with `context.addSafe()`
4. Begin indexing all Safe events from that contract
5. Maintain comprehensive event history for all discovered Safes

This approach ensures complete coverage of Safe activity across the network without manual intervention.

## 🛠️ Setup & Installation

### Prerequisites
- [Node.js (use v18 or newer)](https://nodejs.org/en/download/current)
- [pnpm (use v8 or newer)](https://pnpm.io/installation)
- [Docker desktop](https://www.docker.com/products/docker-desktop/)
- Access to Ethereum Sepolia testnet RPC

### Quick Start

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Generate files from config**
   ```bash
   pnpm run codegen
   ```

3. **Start database (in generated folder)**
   ```bash
   cd generated
   docker compose up
   ```

4. **Run the indexer**
   ```bash
   pnpm dev
   ```

5. **Access GraphQL Playground**
   - Visit http://localhost:8080
   - Local password: `testing`

### Configuration

The indexer is configured via [`config.yaml`](config.yaml):

```yaml
# Network Configuration
networks:
- id: 11155111  # Sepolia Testnet
  start_block: 0

# Contract Monitoring
contracts:
- name: SafeDeploymentFactory
  address: 0xd673f4d06b43a776fe6284f3473053d519ed620c
- name: Safe
  # Dynamically indexes all deployed Safe contracts
```

## 🔧 Development Commands

### Essential Commands
```bash
# Install dependencies
pnpm install

# Generate code from config
pnpm run codegen

# Start development server
pnpm dev

# Start production server
pnpm start
```

### Alternative Start (without TUI)
```bash
TUI_OFF=true pnpm start
```

## 📁 Project Structure

```
indexer/
├── config.yaml              # Envio configuration
├── schema.graphql           # GraphQL schema definition
├── package.json            # Dependencies and scripts
├── abis/                   # Smart contract ABIs
│   ├── Safe.json
│   └── SafeDeploymentFactory.json
├── src/
│   └── EventHandlers.js    # Event processing logic
├── test/
│   └── Test.js            # Test scenarios
└── generated/              # Auto-generated files (after codegen)
    └── docker-compose.yml  # Database configuration
```

## 📋 GraphQL Schema

### Core Entities

#### SafeDeployment
```graphql
type SafeDeployment {
  id: ID!
  safeAddress: String!
  owners: [String!]!
  threshold: Int!
  creator: String!
  blockNumber: Int!
  timestamp: Int!
}
```

#### SafeTransaction
```graphql
type SafeTransaction {
  id: ID!
  safeAddress: String!
  txHash: String
  status: TransactionStatus!
  to: String
  value: String
  timestamp: Int!
}
```

#### SafeOwner
```graphql
type SafeOwner {
  id: ID!
  safeAddress: String!
  owner: String!
  addedAt: Int!
  isActive: Boolean!
}
```


## 🔍 Event Handlers

Event handlers in [`src/EventHandlers.js`](src/EventHandlers.js) process blockchain events:

### Dynamic Loading Registration

One of the key features of our indexer is **Dynamic Contract Registration**. Instead of hardcoding all Safe contract addresses, we use Envio's dynamic loading capability to automatically register new Safe contracts as they are deployed.

#### How Dynamic Loading Works

```javascript
SafeDeploymentFactory.SafeDeployed.contractRegister(({ event, context }) => {
  const safeAddress = event.params.safeAddress.toLowerCase();
  
  // Dynamically register the new Safe contract for indexing
  context.addSafe(safeAddress, event.block.number);
  
  context.log.info(
    `[Dynamic Registration] Registered new Safe at ${safeAddress} from block ${event.block.number}`
  );
});
```

#### Benefits of Dynamic Loading

1. **Automatic Discovery**: No need to manually track and add Safe contract addresses
2. **Real-time Registration**: New Safe contracts are indexed immediately upon deployment
3. **Scalability**: Handles unlimited number of Safe deployments without configuration changes
4. **Historical Indexing**: Can retroactively index Safes from any starting block

#### Configuration Setup

In `config.yaml`, notice how the Safe contract has no hardcoded addresses:

```yaml
- name: Safe
  # address: [] # No addresses specified - using dynamic loading
  abi_file_path: ./abis/Safe.json
  handler: ./src/EventHandlers.js
  events:
    - event: AddedOwner(address owner, address prevOwner, uint256 threshold)
    - event: ExecutionSuccess(bytes32 txHash, uint256 payment)
    # ... other Safe events
```

This approach allows the indexer to:
- Monitor the `SafeDeploymentFactory` for new Safe deployments
- Automatically start indexing events from newly deployed Safe contracts
- Maintain a complete record of all Safe activity across the network

### SafeDeployed Handler
```javascript
SafeDeploymentFactory.SafeDeployed.handler(({ event, context }) => {
  // Creates SafeDeployment entity
  // Initializes SafeOwner entities
  // Sets up Safe tracking
});
```

### Transaction Handlers
```javascript
Safe.ExecutionSuccess.handler(({ event, context }) => {
  // Records successful transaction
  // Updates Safe statistics
});

Safe.ExecutionFailure.handler(({ event, context }) => {
  // Records failed transaction
  // Updates failure metrics
});
```

### Ownership Handlers
```javascript
Safe.AddedOwner.handler(({ event, context }) => {
  // Adds new owner to Safe
  // Updates threshold if changed
});

Safe.RemovedOwner.handler(({ event, context }) => {
  // Removes owner from Safe
  // Updates Safe configuration
});
```

## 🌐 API Integration

The indexer provides a GraphQL API that the Safe Desktop app consumes:

### Service Integration
```javascript
// In Safe Desktop app
import { fetchSafeOverviewData } from '../services/hyperindex.service';

const safeData = await fetchSafeOverviewData(safeAddress);
```

### Query Examples
```javascript
  `query LatestMultiSigTx($limit: Int!) {
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
    };`


    `query SafeDashboard($safeAddress: String!, $limit: Int!) {
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
    `

    `
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
  `

  `
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
  `
```

