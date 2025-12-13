export type IntentFreeTextRequest = {
  text: string;
};

export type IntentFreeTextSuccessResponse = {
  rawText: string;
  parsed: {
    // Canonical coin type strings (from token registry)
    sellToken: string;
    buyToken: string;
    // Decimal strings (UI-friendly)
    sellAmount: string;
    minBuyAmount: string;
    expiresAtMs: number;
  };
};


