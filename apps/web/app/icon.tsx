import { renderHustlePwaIcon } from "../lib/iphone-pwa-icon";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return renderHustlePwaIcon(size.width);
}
