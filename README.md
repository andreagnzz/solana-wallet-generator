# Solana Wallet Generator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

I built this CLI tool to provide a complete, production-ready solution for generating and managing Solana wallets. It supports HD derivation (BIP39/SLIP-0010), vanity address generation, batch operations, AES-256-GCM encryption, Jito MEV bundles, multi-wallet sweep/distribute, and a full rotation system for anti-detection. Compatible with Phantom, Solflare, Backpack, and Ledger.

## Installation

```bash
git clone https://github.com/andreagnzz/solana-wallet-generator.git
cd solana-wallet-generator
npm install
npm run build
```

## Quick Start

```bash
# Generate a simple wallet
solana-wallet generate

# Generate with 24 words, 5 accounts, encrypted output
solana-wallet generate --words 24 --accounts 5 --encrypt --output wallet.json

# Find a vanity address
solana-wallet vanity --prefix So --threads 8

# Send a Jito bundle
solana-wallet bundle-jito --transactions tx1.json tx2.json --tip-strategy p50

# Sweep all wallets to one destination
solana-wallet bundle-sweep --source-bundle wallets.swbundle --destination <address>

# Distribute SOL equally to 10 wallets
solana-wallet bundle-distribute --source-key payer.json --destinations targets.json --strategy equal
```

## Commands

### Wallet Generation

#### `generate` - Create HD Wallet

```bash
solana-wallet generate [options]

Options:
  -w, --words <number>        Word count: 12|15|18|21|24 (default: 12)
  -a, --accounts <number>     Accounts to derive (default: 1, max: 100)
  -p, --passphrase <string>   BIP39 passphrase (25th word)
  -l, --language <lang>       Language: english|french|spanish|japanese
  -o, --output <path>         Output file path
  -e, --encrypt               Encrypt output with AES-256-GCM
  -n, --network <net>         Network: mainnet|devnet|testnet
  --show-private              Show private keys (with warning)
  --qr                        Display QR codes for addresses
  --derivation <path>         Custom derivation path
  --format <fmt>              Output: json|csv|jsonl
```

#### `vanity` - Vanity Address

```bash
solana-wallet vanity [options]

Options:
  --prefix <string>       Desired address prefix
  --suffix <string>       Desired address suffix
  --contains <string>     String contained anywhere
  --case-sensitive        Case-sensitive matching
  --threads <number>      Worker threads (default: CPU cores - 1)
  --save <path>           Save found wallet to file
```

#### `batch` - Batch Generation

```bash
solana-wallet batch [options]

Options:
  -n, --count <number>    Wallets to generate (default: 10, max: 10000)
  -o, --output <path>     Output file path
  --format <fmt>          Format: csv|json|jsonl
  --encrypt               Encrypt private keys
  --no-private            Exclude private keys
  --unique-seed           Unique mnemonic per wallet
  --progress              Show progress
```

### Wallet Operations

#### `inspect` - Inspect Wallet

```bash
solana-wallet inspect [options]

Options:
  --file <path>           Wallet JSON file
  --mnemonic <phrase>     Mnemonic phrase
  --private-key <key>     Private key (base58)
  -a, --accounts <number> Accounts to derive (default: 5)
  --show-balance          Fetch SOL balances
  --show-tokens           Fetch SPL tokens
  --decrypt               Decrypt encrypted file
```

#### `balance` - Check Balance

```bash
solana-wallet balance [options]

Options:
  --address <pubkey>      Solana address
  --file <path>           Wallet file
  -n, --network <net>     Network
  --rpc <url>             Custom RPC URL
  --tokens                Show SPL tokens
  --history <number>      Last N transactions
  --watch                 Auto-refresh every 10s
```

#### `airdrop` - Request Airdrop

```bash
solana-wallet airdrop [options]

Options:
  --address <pubkey>      Destination address
  --amount <sol>          SOL amount (max: 2)
  -n, --network <net>     devnet|testnet only
  --file <path>           Airdrop to all addresses in file
  --delay <ms>            Delay between airdrops
```

#### `sign` - Sign/Verify Messages

```bash
# Sign a message
solana-wallet sign --message "Hello" --private-key <key>

# Verify a signature
solana-wallet sign --verify --message "Hello" --signature <sig> --address <pubkey>
```

### Jito MEV Bundles

#### `bundle-jito` - Send Atomic Bundle

```bash
solana-wallet bundle-jito [options]

Options:
  --transactions <paths...>   Transaction JSON files (max 4 user txs)
  --tip-strategy <strategy>   Tip: min|p25|p50|p75|p95|custom (default: p50)
  --tip-amount <lamports>     Custom tip in lamports
  --region <region>           Jito region: mainnet|amsterdam|frankfurt|ny|tokyo
  --monitor                   Monitor bundle until landing (default: true)
  --timeout <ms>              Monitoring timeout (default: 60000)
  --simulate                  Simulate before sending
  --dry-run                   Build without sending
  --keypair <path>            Fee payer keypair JSON file
```

Multi-region failover is built in. If the primary region fails, the client automatically tries fallback regions.

### Multi-Wallet Operations

#### `bundle-sweep` - Sweep to One Destination

Consolidate SOL and SPL tokens from multiple wallets into a single destination.

```bash
solana-wallet bundle-sweep [options]

Options:
  --source-file <path>        JSON file with source wallets
  --source-bundle <path>      Encrypted .swbundle file
  --destination <address>     Destination address
  --mode <mode>               sol-only|tokens-only|all (default: all)
  --keep-rent                 Keep rent exemption balance (default: true)
  --use-jito                  Use Jito for atomicity
  --concurrent <n>            Parallel wallets (default: 5)
  --dry-run                   Estimate without sending
```

#### `bundle-distribute` - Distribute to Many

Distribute SOL or SPL tokens from one wallet to many destinations.

```bash
solana-wallet bundle-distribute [options]

Options:
  --source-key <path>         Source keypair JSON file
  --destinations <path>       Destinations JSON/CSV file
  --token <mint>              SPL token mint (omit for native SOL)
  --strategy <strategy>       equal|weighted|fixed|fill-to (default: equal)
  --total <amount>            Total amount in lamports
  --target-balance <lamports> Target balance for fill-to strategy
  --create-ata                Create missing ATAs (default: true)
  --use-jito                  Use Jito bundles
  --dry-run                   Validate without sending
```

### Wallet Bundle Keystore

Encrypted `.swbundle` files store multiple wallets in a single file with AES-256-GCM + Argon2id.

```bash
# Pack wallets into an encrypted bundle
solana-wallet bundle-pack --input wallet1.json wallet2.json -o farm.swbundle

# List wallets without decrypting (addresses only)
solana-wallet bundle-list --file farm.swbundle

# Extract specific wallets
solana-wallet bundle-unpack --file farm.swbundle --indices 0,2,4

# Add a wallet to an existing bundle
solana-wallet bundle-add --file farm.swbundle --wallet new.json

# Merge multiple bundles
solana-wallet bundle-merge --files a.swbundle b.swbundle -o merged.swbundle
```

## Bundler Architecture

### Shared Infrastructure

- **RPC Pool** — Multi-endpoint connection pool with round-robin, fastest, weighted-random, and failover strategies. Automatic health checks and latency monitoring.
- **Priority Fees** — Dynamic priority fee estimation from recent block data.
- **Transaction Builder** — Versioned transaction construction with compute budget optimization.
- **Retry Engine** — Smart retry with Solana error classification (blockhash expired, rate limited, insufficient funds, etc). Exponential backoff with jitter.
- **Simulation** — Pre-flight simulation for individual transactions and full bundles.

### Rotation System

The rotation module prevents pattern detection when submitting multiple bundles:

- **TipRotator** — Rotates across all 8 Jito tip accounts. Never selects the same account consecutively. Varies tip amounts within a configurable range using `crypto.randomBytes`.
- **TimingRotator** — Generates human-like delays between submissions with bursts (rapid-fire), normal delays, and pauses. All randomness from `crypto.randomBytes`.
- **RegionRotator** — Distributes bundle submissions across Jito's 5 geographic regions. Optional latency tracking.
- **SignerRotator** — Rotates fee-paying wallets with configurable cooldown periods and max consecutive use limits.
- **PatternEngine** — Orchestrates all four rotators. Produces a `DetectionRiskReport` analyzing consecutive repeat rates and timing variance.

### Multi-Bundle Sequencer

For submitting batches of bundles:

- **Sequential** — Bundle N+1 is not sent until bundle N lands or fails.
- **Pipelined** — All bundles sent immediately, monitored in parallel.
- **Adaptive** — Starts pipelined, switches to sequential after a configurable failure threshold (default: 30%).
- Abort on critical failure with configurable max failures.

## Security Considerations

This project takes security seriously:

- Private keys are **never** displayed without the explicit `--show-private` flag
- File encryption uses **AES-256-GCM** with **Argon2id** key derivation (3 iterations, 64MB memory)
- Sensitive memory (seed buffers, key material) is zeroed after use
- All BIP39 checksums are validated before any derivation
- Input sanitization on all user-facing parameters to prevent injection
- Wallet files (`.json`, `.csv`, `.swbundle`) are gitignored by default
- All randomness in the rotation system uses `crypto.randomBytes`, not `Math.random`

## Wallet Compatibility

| Wallet    | Derivation Path          | Compatible |
|-----------|--------------------------|------------|
| Phantom   | m/44'/501'/{i}'/0'       | Yes        |
| Solflare  | m/44'/501'/{i}'/0'       | Yes        |
| Backpack  | m/44'/501'/{i}'/0'       | Yes        |
| Ledger    | m/44'/501'/{i}'          | Yes        |

## Development

```bash
npm run dev          # Run in development mode
npm test             # Run tests with coverage (218 tests, 90%+ coverage)
npm run build        # Compile TypeScript
npm run lint         # Lint source code
```

## Contributing

Contributions are welcome! If you'd like to contribute:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Write tests for your changes
4. Make sure all tests pass (`npm test`)
5. Commit your changes
6. Push to your branch and open a Pull Request

Please make sure your code follows the existing style and passes linting.

## License

MIT
