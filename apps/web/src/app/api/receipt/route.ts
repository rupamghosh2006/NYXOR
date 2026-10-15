import { NextRequest, NextResponse } from "next/server";

const L1_RPC_URL =
  "https://nodes-prod.43.207.73.245.sslip.io/ext/bc/2SrgwcLrpgt2kLrqhTr6fMaPFd1kN467ai3eaK4HcFyBq1YbaY/rpc";
const FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc";

// In-memory cache for mined receipts (hash -> receipt)
const receiptCache = new Map<string, any>();

async function fetchWithRetry(url: string, body: any, maxRetries = 3): Promise<any> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (res.status === 429) {
        attempt++;
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
          continue;
        }
      }

      return await res.json();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const txHash = searchParams.get("txHash");
  const chainId = searchParams.get("chainId");

  if (!txHash) {
    return NextResponse.json({ error: "Missing txHash parameter" }, { status: 400 });
  }

  // Check cache
  const cacheKey = `${chainId || 98421}:${txHash.toLowerCase()}`;
  if (receiptCache.has(cacheKey)) {
    return NextResponse.json({ result: receiptCache.get(cacheKey), cached: true });
  }

  const isL1 = chainId === "98421" || !chainId || chainId === "undefined";
  const rpcUrl = isL1 ? L1_RPC_URL : FUJI_RPC_URL;

  try {
    const data = await fetchWithRetry(rpcUrl, {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });

    if (data?.result) {
      receiptCache.set(cacheKey, data.result);
      return NextResponse.json({ result: data.result });
    }

    if (data?.error) {
      return NextResponse.json(
        { error: typeof data.error === "string" ? data.error : data.error.message || "RPC Error" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Transaction not yet mined or pending in mempool" },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to query node RPC" }, { status: 500 });
  }
}
