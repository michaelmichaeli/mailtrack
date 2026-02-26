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
};

export function getCarrierTrackingUrl(carrier: string, trackingNumber: string): string | null {
  const builder = CARRIER_URLS[carrier];
  return builder ? builder(trackingNumber) : null;
}
