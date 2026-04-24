import { useContext } from "react";
import { WalletContext } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

// Lightweight wrapper that signs a raw transaction (legacy or versioned)
// using the Solana wallet adapter. Returns null when no wallet is connected
// or when the provider isn't mounted yet (SSR / first paint).
export function useSafeSignTransaction() {
  const walletCtx = useContext(WalletContext);
  if (!walletCtx) return null;
  const { signTransaction, publicKey } = walletCtx;
  if (!signTransaction || !publicKey) return null;
  return {
    address: publicKey.toBase58(),
    signTransaction: async ({ transaction }: { transaction: Uint8Array }) => {
      let tx: Transaction | VersionedTransaction;
      try {
        tx = VersionedTransaction.deserialize(transaction);
      } catch {
        tx = Transaction.from(transaction);
      }
      const signed = await signTransaction(tx);
      const serialized =
        "serialize" in signed
          ? signed.serialize()
          : (signed as Transaction).serialize();
      return { signedTransaction: new Uint8Array(serialized) };
    },
  };
}
