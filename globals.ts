import type { EIP1193Provider } from "eip1193-provider";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}
