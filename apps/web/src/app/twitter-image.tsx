import { ImageResponse } from "next/og";
import OGImage, { alt as ogAlt, size as ogSize } from "./opengraph-image";

export const runtime = "edge";
export const alt = ogAlt;
export const size = ogSize;
export const contentType = "image/png";

export default OGImage;
