import { renderHustlePwaIcon } from "../lib/iphone-pwa-icon";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderHustlePwaIcon(size.width);
}
