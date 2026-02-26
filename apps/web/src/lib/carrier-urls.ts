/** Build a tracking URL for the carrier's own website */
const CARRIER_URLS: Record<string, (tn: string) => string> = {
  DHL: (tn) => `https://www.dhl.com/global-en/home/tracking/tracking-global-forwarding.html?submit=1&tracking-id=${tn}`,
  UPS: (tn) => `https://www.ups.com/track?tracknum=${tn}`,
  FEDEX: (tn) => `https://www.fedex.com/fedextrack/?trknbr=${tn}`,
  USPS: (tn) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tn}`,
  DPD: (tn) => `https://track.dpd.co.uk/parcels/${tn}`,
  ROYAL_MAIL: (tn) => `https://www.royalmail.com/track-your-item#/tracking-results/${tn}`,
  CAINIAO: (tn) => `https://global.cainiao.com/detail.htm?mailNoList=${tn}`,
  YANWEN: (tn) => `https://track.yw56.com.cn/en/querydel?nums=${tn}`,
  ALIEXPRESS_STANDARD: (tn) => `https://global.cainiao.com/detail.htm?mailNoList=${tn}`,
  ISRAEL_POST: (tn) => `https://mypost.israelpost.co.il/itemtrace?itemcode=${tn}`,
  FOUR_PX: (tn) => `https://track.4px.com/#/result/0/${tn}`,
  SUNYOU: (tn) => `https://www.sypost.net/queryresult.html?nos=${tn}`,
  YUNEXPRESS: (tn) => `https://www.yuntrack.com/Track/Detail/${tn}`,
  JT_EXPRESS: (tn) => `https://www.jtexpress.com/trajectoryQuery?waybillNo=${tn}`,
  ARAMEX: (tn) => `https://www.aramex.com/track/results?ShipmentNumber=${tn}`,
  POSTNL: (tn) => `https://postnl.nl/tracktrace/?B=${tn}`,
  LA_POSTE: (tn) => `https://www.laposte.fr/outils/suivre-vos-envois?code=${tn}`,
  CANADA_POST: (tn) => `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${tn}`,
  TNT: (tn) => `https://www.tnt.com/express/en_gc/site/tracking.html?searchType=con&cons=${tn}`,
  GLS: (tn) => `https://gls-group.com/track/${tn}`,
};

/** Friendly carrier display names */
const CARRIER_DISPLAY_NAMES: Record<string, string> = {
  ALIEXPRESS_STANDARD: "Cainiao",
  CAINIAO: "Cainiao",
  YANWEN: "Yanwen",
  DHL: "DHL",
  UPS: "UPS",
  FEDEX: "FedEx",
  USPS: "USPS",
  DPD: "DPD",
  ROYAL_MAIL: "Royal Mail",
  ISRAEL_POST: "Israel Post",
  FOUR_PX: "4PX",
  SUNYOU: "SunYou",
  YUNEXPRESS: "YunExpress",
  JT_EXPRESS: "J&T Express",
  ARAMEX: "Aramex",
  POSTNL: "PostNL",
  LA_POSTE: "La Poste",
  CANADA_POST: "Canada Post",
  TNT: "TNT",
  GLS: "GLS",
};

export function getCarrierDisplayName(carrier: string): string {
  return CARRIER_DISPLAY_NAMES[carrier] ?? carrier;
}

export function getCarrierTrackingUrl(carrier: string, trackingNumber: string): string | null {
  const builder = CARRIER_URLS[carrier];
  if (builder) return builder(trackingNumber);
  // Fallback: try 17track universal search
  return `https://t.17track.net/en#nums=${trackingNumber}`;
}
