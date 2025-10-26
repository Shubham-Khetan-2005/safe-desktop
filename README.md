


# Safe Desktop: 2-of-3 Multisig Wallet

## What is this project?

**Safe Desktop** is a multisig wallet that combines **user-friendly UX** with **hardware-grade security**.

Each transaction requires **2-of-3 signatures**, one of which is produced by your laptop’s **Trusted Platform Module (TPM)** — meaning even if private keys leak, **transactions can only be executed from your physical device**.

Envio’s **HyperIndex** powers real-time event tracking, while **Dynamic Contracts** enable flexible Safe deployments and ownership rotation **without redeploying contracts**.

---

## Releases:
Currently, we support Linux and Windows, with Mac release in the near future.
Download the latest executables here:
[executables](https://drive.google.com/drive/folders/1LQIZBFXmstUoh1MJsLxvrBUqHAKhl8c6?usp=sharing )

## Why does this project exist?

Multisig wallets are a critical building block for secure digital asset management, DAO treasuries, and collaborative finance. However, most multisig tools are:
- Web-based (less secure for key management)
- Opaque in their key handling and transaction flow
- Not easily extensible for research or integration with hardware security modules

**Safe Desktop** solves these problems by:
- Making all key management transparent and local-first
- Providing a clear, auditable workflow for every step
- Integrating a TPM server for hardware-backed key simulation
- Allowing both predeployed and dynamically created Safes
- Maximizing usability with auto-funding and modern UI

---

## Repository Structure
```
root/
│  electron.cjs, electron.main.js, index.html, package.json, vite.config.js
│
├─ src/
│   ├─ styles.css
│   ├─ lib/
│   │   └─ safeKit.js
│   └─ renderer/
│       ├─ App.jsx, App.css
│       ├─ main.jsx
│       ├─ components/
│       │   ├─ SafeSetup.jsx      # Key generation, Safe deployment, auto-funding
│       │   ├─ TxComposer.jsx     # Transaction creation, signing, sending
│       │   ├─ KeyGenerator.jsx   # Key pair generation UI
│       │   ├─ Modal.jsx, StatusPanel.jsx
│       ├─ context/
│       │   └─ SafeContext.jsx    # Global Safe state management
│       ├─ pages/
│       │   ├─ Dashboard.jsx, HyperIndexPage.jsx, TxLifecycle.jsx
│       └─ services/
│           ├─ safe-sdk.service.js, hyperindex.service.js, sig-utils.js
│
├─ indexer/   # Indexing and ABI files
├─ server/    # Backend API for Safe and signature utilities
├─ tpm-signing-agent/ # TPM server, Go code, and scripts
```

---
## Features
### 1. Key Generation
- Use the **SafeSetup** page to generate two local key pairs.
- Key 1: User's private key (must be saved securely).
- Key 2: App's key (used for signing in the app).
- TPM server public key is fetched as the third owner.

### 2. Predeployed Safe Option
- If `VITE_SAFE_ADDRESS` is set in `.env`, you can use a pre-existing Safe for instant testing.

### 3. Deploying a Dynamic Safe
- Deploy a new Safe contract with the three owners (Key 1, Key 2, TPM key).
- The app checks the deployer wallet balance and prompts for test ETH if needed.
- After deployment, the app automatically funds the Safe with all available ETH (minus estimated gas and a small buffer).

### 4. Transaction Composer
- After deployment or with a predeployed Safe, use the **TxComposer** to:
  - Create new transactions from the Safe.
  - Sign with local keys.
  - Submit transactions to the Safe contract.

### 5. TPM Server Integration
- The TPM server provides a public key for use as a Safe owner.
- If the server is unavailable, a fallback key is used for testing.

### 6. Dynamic Contract Deployment
- We save
- Hosted link for Dynamic Contract: https://indexer.dev.hyperindex.xyz/8ac8f29/v1/graphql
- Hosted link for example static Contract: https://indexer.dev.hyperindex.xyz/98cbc95/v1/graphql (Safe address: https://sepolia.etherscan.io/address/0x601778f8fa32298e826a8abef1e3b31515626845) 
---
## Architecure
<img width="2371" height="2101" alt="Architecture (1)" src="https://github.com/user-attachments/assets/b9911394-b055-42b2-9634-7e605e242e05" />


- **SafeSetup.jsx**: Handles key generation, TPM key fetch, Safe deployment, and auto-funding logic.
- **TxComposer.jsx**: UI for composing, signing, and sending Safe transactions.
- **KeyGenerator.jsx**: UI for generating and displaying key pairs.
- **SafeContext.jsx**: React context for Safe state (keys, addresses, etc).
- **App.jsx**: Main app shell and navigation.
- **Dashboard.jsx, HyperIndexPage.jsx, TxLifecycle.jsx**: Pages for activity, indexing, and transaction lifecycle.
- **server/**: Backend for Safe SDK and signature utilities.
- **tpm-signing-agent/**: TPM server and Go code for secure key management.

## How do I use it?

1. **Install dependencies**
	```sh
	npm install
	# or
	pnpm install
	```

2. **Set up environment variables**
	- Create a `.env` file with:
	  ```env
	  VITE_RPC_URL=YOUR_SEPOLIA_RPC_URL
	  VITE_CHAIN_ID=11155111
	  VITE_SAFE_ADDRESS= # (optional, for predeployed Safe)
	  ```

3. **Start the TPM server (optional, for real signing)**
	- See `tpm-signing-agent/README.md` for setup.

4. **Run the app**
	```sh
	npm run dev
	# or
	pnpm dev
	```

---


## Credits & Acknowledgements
- Built with [Safe protocol-kit](https://github.com/safe-global/safe-core-sdk), [ethers.js](https://docs.ethers.org/), and React.
- TPM server based on Go and Node.js integration.

---


## License
MIT

