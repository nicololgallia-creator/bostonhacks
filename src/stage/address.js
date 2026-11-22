// Which address the floor's QR code holds. Kept apart from main.js so the choice can be tested.
import { onLaptopNetwork } from "../link.js";

// A floor on a public address (ttiles.us/floor) has no local server, so /lan is a 404 there and must never be asked.
export const asksLan = (hostname) => onLaptopNetwork(hostname);

// The address phones are sent to, or null when there is none yet.
//   envUrl:  VITE_PUBLIC_URL ("" when unset). origin: the page's own origin. lanUrl: the laptop's address from /lan, or null.
// A public floor is its own phone address, whatever the relay is doing, so its QR code never goes away.
// A floor on the laptop's network uses envUrl once the relay is up, else the laptop's address.
export function joinBase({ hostname, envUrl, origin, relayUp, lanUrl }) {
  if (!asksLan(hostname)) return envUrl || origin;
  return envUrl && relayUp ? envUrl : lanUrl ?? null;
}
