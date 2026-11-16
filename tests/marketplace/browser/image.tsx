import type { ImgHTMLAttributes } from "react";
export default function Image({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  // Test-only image adapter; no optimizer request and no external image access.
  return <img src={typeof src === "string" ? src : undefined} alt={alt} className={props.className} />;
}
