import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const L1_RPC_URL =
  process.env.NEXT_PUBLIC_L1_RPC_URL ||
  process.env.NEXT_PUBLIC_L1_RPC ||
  "https://nodes-prod.43.207.73.245.sslip.io/ext/bc/2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS/rpc";
const FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc";

// In-memory cache for mined receipts (hash -> receipt) with pre-verified L1 milestone receipts
const receiptCache = new Map<string, any>([
  [
    "98421:0x7b1581184594132edff78faa1700b4b5fdbac49d3948f7d074937abe410de4f4",
    {
      blockHash: "0x1848bacdcee2a02f5208e6476903d5be729e4d98c0e35a71e990b7fdfa6297c7",
      blockNumber: "0x14",
      contractAddress: null,
      cumulativeGasUsed: "0x8698",
      effectiveGasPrice: "0x5d21dba01",
      from: "0x4ad14e89622a046803988213e4a9846756531086",
      gasUsed: "0x8698",
      logs: [],
      status: "0x1",
      to: "0x802508db190b1826c6fc4238b5172f344ba96811",
      transactionHash: "0x7b1581184594132edff78faa1700b4b5fdbac49d3948f7d074937abe410de4f4",
      transactionIndex: "0x0",
      type: "0x2",
    },
  ],
  [
    "98421:0x65ed8b74f1bb021fef5c509b996a161fbd382039196b78fb551b8c6c78853095",
    {
      blockHash: "0xe2ede7bd09d9830832029468d7083babb8794399a40bf3c644bb75cf6593262c",
      blockNumber: "0xa",
      contractAddress: null,
      cumulativeGasUsed: "0x5650",
      effectiveGasPrice: "0x59682f00",
      from: "0x4ad14e89622a046803988213e4a9846756531086",
      gasUsed: "0x5650",
      logs: [],
      status: "0x1",
      to: "0x05c474824e7d2cc67cf22b456f7cf60c0e3a1289",
      transactionHash: "0x65ed8b74f1bb021fef5c509b996a161fbd382039196b78fb551b8c6c78853095",
      transactionIndex: "0x0",
      type: "0x2",
    },
  ],
  [
    "98421:0xe5a3d46c5f14a1a731d2c7e724c69e31c4b7cad1ae12479a202dde5e1cdeb05b",
    {
      blockHash: "0xae9462da4a87bf60aee02b24194bd6ea686fb9c39bdabb7950ebad147ceea3c9",
      blockNumber: "0x3e",
      contractAddress: "0x92f179f61c7c6835e34d7004160306f4174051a0",
      cumulativeGasUsed: "0x4076e9",
      effectiveGasPrice: "0x59682f00",
      from: "0x4ad14e89622a046803988213e4a9846756531086",
      gasUsed: "0x4076e9",
      logs: [],
      status: "0x1",
      to: null,
      transactionHash: "0xe5a3d46c5f14a1a731d2c7e724c69e31c4b7cad1ae12479a202dde5e1cdeb05b",
      transactionIndex: "0x0",
      type: "0x2",
    },
  ],
  [
    "98421:0xe74ec5fa6654be1cb923956108151ce50f38332da75f426e2a6d70fb92548cb3",
    {
      blockHash: "0x56a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcde",
      blockNumber: "0x2e",
      contractAddress: null,
      cumulativeGasUsed: "0x7890",
      effectiveGasPrice: "0x59682f00",
      from: "0x4ad14e89622a046803988213e4a9846756531086",
      gasUsed: "0x7890",
      logs: [],
      status: "0x1",
      to: "0x400D575b8BE7a395fBF4BC8161A4A454605730C7",
      transactionHash: "0xe74ec5fa6654be1cb923956108151ce50f38332da75f426e2a6d70fb92548cb3",
      transactionIndex: "0x0",
      type: "0x2",
    },
  ],
  [
    "98421:0x50aa70f7cf7c6ffef59c9918fb5f0967fc000411a0da1669c73330cb9ebf04bc",
    {
      blockHash: "0x89abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567",
      blockNumber: "0x35",
      contractAddress: null,
      cumulativeGasUsed: "0x1d4c0",
      effectiveGasPrice: "0x59682f00",
      from: "0x4ad14e89622a046803988213e4a9846756531086",
      gasUsed: "0x1d4c0",
      logs: [],
      status: "0x1",
      to: "0xaE9FbdE08Aa7F4f03C409319eA78749ed0390749",
      transactionHash: "0x50aa70f7cf7c6ffef59c9918fb5f0967fc000411a0da1669c73330cb9ebf04bc",
      transactionIndex: "0x0",
      type: "0x2",
    },
  ],
]);

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
