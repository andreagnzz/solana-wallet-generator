# Solana Wallet Generator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

I built this CLI tool to provide a complete, production-ready solution for generating and managing Solana wallets. It supports HD derivation (BIP39/SLIP-0010), vanity address generation, batch operations, AES-256-GCM encryption, and is fully compatible with Phantom, Solflare, Backpack, and Ledger.

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
```

## Commands

### `generate` - Create HD Wallet

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

### `vanity` - Vanity Address

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

### `batch` - Batch Generation

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

### `inspect` - Inspect Wallet

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

### `balance` - Check Balance

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

### `airdrop` - Request Airdrop

```bash
solana-wallet airdrop [options]

Options:
  --address <pubkey>      Destination address
  --amount <sol>          SOL amount (max: 2)
  -n, --network <net>     devnet|testnet only
  --file <path>           Airdrop to all addresses in file
  --delay <ms>            Delay between airdrops
```

### `sign` - Sign/Verify Messages

```bash
# Sign a message
solana-wallet sign --message "Hello" --private-key <key>

# Verify a signature
solana-wallet sign --verify --message "Hello" --signature <sig> --address <pubkey>
```

## Security Considerations

This project takes security seriously:

- Private keys are **never** displayed without the explicit `--show-private` flag
- File encryption uses **AES-256-GCM** with **Argon2id** key derivation (3 iterations, 64MB memory)
- Sensitive memory (seed buffers, key material) is zeroed after use
- All BIP39 checksums are validated before any derivation
- Input sanitization on all user-facing parameters to prevent injection
- Wallet files (`.json`, `.csv`) are gitignored by default

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
npm test             # Run tests with coverage
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
