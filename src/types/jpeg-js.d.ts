declare module 'jpeg-js' {
  type RawImage = { data: Uint8Array; width: number; height: number };
  const jpeg: {
    decode(
      data: Uint8Array | ArrayBuffer,
      opts?: { useTArray?: boolean; formatAsRGBA?: boolean; tolerantDecoding?: boolean; maxResolutionInMP?: number; maxMemoryUsageInMB?: number },
    ): RawImage;
    encode(image: RawImage, quality?: number): { data: Uint8Array; width: number; height: number };
  };
  export default jpeg;
}
