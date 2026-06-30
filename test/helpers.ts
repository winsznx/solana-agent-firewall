import { Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { PROGRAMS } from "../src/core/allowlist.js";
import { U64_MAX } from "../src/core/utils.js";

export function serializeUnsigned(instructions: TransactionInstruction[], payer = Keypair.generate()): string {
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  return Buffer.from(tx.serialize()).toString("base64");
}

export function unlimitedApproveInstruction(owner: PublicKey): TransactionInstruction {
  const source = Keypair.generate().publicKey;
  const delegate = Keypair.generate().publicKey;
  const data = Buffer.alloc(9);
  data[0] = 4;
  data.writeBigUInt64LE(U64_MAX, 1);
  return new TransactionInstruction({
    programId: new PublicKey(PROGRAMS.token),
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: delegate, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false }
    ],
    data
  });
}

export function closeToAttackerInstruction(owner: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(PROGRAMS.token),
    keys: [
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false }
    ],
    data: Buffer.from([9])
  });
}

export function mintAuthorityHandoffInstruction(owner: PublicKey): TransactionInstruction {
  const data = Buffer.alloc(35);
  data[0] = 6;
  data[1] = 0;
  data[2] = 1;
  Keypair.generate().publicKey.toBuffer().copy(data, 3);
  return new TransactionInstruction({
    programId: new PublicKey(PROGRAMS.token),
    keys: [
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false }
    ],
    data
  });
}

export function unknownProgramInstruction(owner: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: Keypair.generate().publicKey,
    keys: [{ pubkey: owner, isSigner: true, isWritable: true }],
    data: Buffer.from([1, 2, 3, 4])
  });
}
