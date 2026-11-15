declare module "qrcode-svg" {
  type QrOptions = {
    content: string;
    padding?: number;
    width?: number;
    height?: number;
    color?: string;
    background?: string;
    ecl?: "L" | "M" | "Q" | "H";
    join?: boolean;
    pretty?: boolean;
    xmlDeclaration?: boolean;
  };
  export default class QRCode {
    constructor(content: string | QrOptions);
    svg(): string;
  }
