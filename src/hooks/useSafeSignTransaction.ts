import { useSignTransaction } from "@privy-io/react-auth/solana";

// Safe wrapper — returns null when Privy provider isn't mounted.
export function useSafeSignTransaction() {
  try {
    return useSignTransaction();
  } catch {
    return null;
  }
}
