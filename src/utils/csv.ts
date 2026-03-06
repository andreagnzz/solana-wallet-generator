import * as fs from 'fs';
import { format, parse } from 'fast-csv';
import { BatchWalletEntry } from '../types';

/**
 * Export wallet entries to CSV file
 *
 * @param entries - Array of wallet entries to export
 * @param filepath - Output file path
 * @param includePrivate - Whether to include private keys
 */
export async function exportToCSV(
  entries: BatchWalletEntry[],
  filepath: string,
  includePrivate: boolean = true
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(filepath);

    const csvStream = format({ headers: true });
    csvStream.pipe(ws);

    for (const entry of entries) {
      if (includePrivate) {
        csvStream.write({
          index: entry.index,
          address: entry.address,
          privateKey: entry.privateKey,
          mnemonic: entry.mnemonic,
          derivationPath: entry.derivationPath,
          createdAt: entry.createdAt,
        });
      } else {
        csvStream.write({
          index: entry.index,
          address: entry.address,
          derivationPath: entry.derivationPath,
          createdAt: entry.createdAt,
        });
      }
    }

    csvStream.end();

    ws.on('finish', resolve);
    ws.on('error', reject);
  });
}

/**
 * Import wallet addresses from CSV file
 *
 * @param filepath - Input CSV file path
 * @returns Array of parsed wallet entries
 */
export async function importFromCSV(
  filepath: string
): Promise<BatchWalletEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: BatchWalletEntry[] = [];

    fs.createReadStream(filepath)
      .pipe(parse({ headers: true }))
      .on('data', (row: Record<string, string>) => {
        entries.push({
          index: parseInt(row['index'] || '0', 10),
          address: row['address'] || '',
          privateKey: row['privateKey'] || '',
          mnemonic: row['mnemonic'] || '',
          derivationPath: row['derivationPath'] || '',
          createdAt: row['createdAt'] || '',
        });
      })
      .on('end', () => resolve(entries))
      .on('error', reject);
  });
}

/**
 * Export wallet entries to JSONL (JSON Lines) format
 *
 * @param entries - Array of wallet entries
 * @param filepath - Output file path
 * @param includePrivate - Whether to include private keys
 */
export async function exportToJSONL(
  entries: BatchWalletEntry[],
  filepath: string,
  includePrivate: boolean = true
): Promise<void> {
  const lines = entries.map((entry) => {
    if (includePrivate) {
      return JSON.stringify(entry);
    }
    const { privateKey: _pk, mnemonic: _mn, ...safe } = entry;
    return JSON.stringify(safe);
  });

  fs.writeFileSync(filepath, lines.join('\n') + '\n', 'utf8');
}
