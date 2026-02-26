<?php

namespace App\Services;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

class ExchangeTickerService
{
    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
            'timeout' => 15,
            'connect_timeout' => 5,
            'http_errors' => false,
        ]);
    }

    public function getBidAsk(string $exchange, string $symbol): ?array
    {
        $exchange = trim($exchange);
        $symbol = trim($symbol);
        if ($exchange === '' || $symbol === '') {
            return null;
        }

        [$base, $quote] = $this->splitSymbol($symbol);
        if ($base === '' || $quote === '') {
            return null;
        }

        try {
            if ($exchange === 'Binance') {
                $pair = strtoupper($base . $quote);
                $resp = $this->http->get('https://api.binance.com/api/v3/ticker/bookTicker', [
                    'query' => ['symbol' => $pair],
                ]);
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $bid = $data['bidPrice'] ?? null;
                $ask = $data['askPrice'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'OKX') {
                $pair = strtoupper($base) . '-' . strtoupper($quote);
                $resp = $this->http->get('https://www.okx.com/api/v5/market/ticker', [
                    'query' => ['instId' => $pair],
                ]);
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $row = is_array($data) && isset($data['data'][0]) ? $data['data'][0] : null;
                if (!is_array($row)) {
                    return null;
                }
                $bid = $row['bidPx'] ?? null;
                $ask = $row['askPx'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'Bybit') {
                $pair = strtoupper($base . $quote);
                $resp = $this->http->get('https://api.bybit.com/v5/market/tickers', [
                    'query' => ['category' => 'spot', 'symbol' => $pair],
                ]);
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $row = is_array($data) && isset($data['result']['list'][0]) ? $data['result']['list'][0] : null;
                if (!is_array($row)) {
                    return null;
                }
                $bid = $row['bid1Price'] ?? null;
                $ask = $row['ask1Price'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'KuCoin') {
                $pair = strtoupper($base) . '-' . strtoupper($quote);
                $resp = $this->http->get('https://api.kucoin.com/api/v1/market/orderbook/level1', [
                    'query' => ['symbol' => $pair],
                ]);
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $row = is_array($data) && isset($data['data']) && is_array($data['data']) ? $data['data'] : null;
                if (!is_array($row)) {
                    return null;
                }
                $bid = $row['bestBid'] ?? null;
                $ask = $row['bestAsk'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'Gate') {
                $pair = strtoupper($base) . '_' . strtoupper($quote);
                $resp = $this->http->get('https://api.gateio.ws/api/v4/spot/tickers', [
                    'query' => ['currency_pair' => $pair],
                    'headers' => ['Accept' => 'application/json'],
                ]);
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $row = is_array($data) && isset($data[0]) && is_array($data[0]) ? $data[0] : null;
                if (!is_array($row)) {
                    return null;
                }
                $bid = $row['highest_bid'] ?? null;
                $ask = $row['lowest_ask'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'Huobi') {
                $pair = strtolower($base . $quote);
                $resp = $this->http->get('https://api.huobi.pro/market/detail/merged', [
                    'query' => ['symbol' => $pair],
                ]);
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $tick = is_array($data) && isset($data['tick']) && is_array($data['tick']) ? $data['tick'] : null;
                if (!is_array($tick)) {
                    return null;
                }
                $bid = is_array($tick['bid'] ?? null) ? ($tick['bid'][0] ?? null) : null;
                $ask = is_array($tick['ask'] ?? null) ? ($tick['ask'][0] ?? null) : null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'Bitfinex') {
                $pair = 't' . strtoupper($base . $quote);
                $resp = $this->http->get("https://api-pub.bitfinex.com/v2/ticker/{$pair}");
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                if (!is_array($data) || count($data) < 4) {
                    return null;
                }
                $bid = $data[0] ?? null;
                $ask = $data[2] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'Bitstamp') {
                $pair = strtolower($base . $quote);
                $resp = $this->http->get("https://www.bitstamp.net/api/v2/ticker/{$pair}/");
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $bid = $data['bid'] ?? null;
                $ask = $data['ask'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'Kraken') {
                $b = strtoupper($base);
                $q = strtoupper($quote);
                if ($b === 'BTC') {
                    $b = 'XBT';
                }
                $pair = $b . $q;
                $resp = $this->http->get('https://api.kraken.com/0/public/Ticker', [
                    'query' => ['pair' => $pair],
                ]);
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $result = is_array($data) && isset($data['result']) && is_array($data['result']) ? $data['result'] : null;
                if (!is_array($result) || empty($result)) {
                    return null;
                }
                $firstKey = (string) array_key_first($result);
                $row = $result[$firstKey] ?? null;
                if (!is_array($row)) {
                    return null;
                }
                $bid = is_array($row['b'] ?? null) ? ($row['b'][0] ?? null) : null;
                $ask = is_array($row['a'] ?? null) ? ($row['a'][0] ?? null) : null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'Coinbase') {
                $pair = strtoupper($base) . '-' . strtoupper($quote);
                $resp = $this->http->get("https://api.exchange.coinbase.com/products/{$pair}/ticker", [
                    'headers' => ['Accept' => 'application/json'],
                ]);
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $bid = $data['bid'] ?? null;
                $ask = $data['ask'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'Poloniex') {
                $pair = strtoupper($base) . '_' . strtoupper($quote);
                $resp = $this->http->get('https://api.poloniex.com/markets/' . $pair . '/ticker');
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $bid = $data['bestBid'] ?? null;
                $ask = $data['bestAsk'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'Exmo') {
                $pair = strtoupper($base) . '_' . strtoupper($quote);
                $resp = $this->http->get('https://api.exmo.com/v1.1/ticker');
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $row = is_array($data) ? ($data[$pair] ?? null) : null;
                if (!is_array($row)) {
                    return null;
                }
                $bid = $row['buy_price'] ?? null;
                $ask = $row['sell_price'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'CEX.IO') {
                $pair = strtoupper($base) . '/' . strtoupper($quote);
                $resp = $this->http->get('https://cex.io/api/ticker/' . $pair);
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $bid = $data['bid'] ?? null;
                $ask = $data['ask'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'HitBTC') {
                $pair = strtoupper($base . $quote);
                $resp = $this->http->get('https://api.hitbtc.com/api/3/public/ticker');
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $row = is_array($data) ? ($data[$pair] ?? null) : null;
                if (!is_array($row)) {
                    return null;
                }
                $bid = $row['bid'] ?? null;
                $ask = $row['ask'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }

            if ($exchange === 'BitMEX') {
                $b = strtoupper($base);
                $q = strtoupper($quote);
                if ($b === 'BTC') {
                    $b = 'XBT';
                }
                $symbolMap = [
                    'USD' => $b . 'USD',
                    'USDT' => $b . 'USDT',
                ];
                $inst = $symbolMap[$q] ?? ($b . $q);
                $resp = $this->http->get('https://www.bitmex.com/api/v1/instrument', [
                    'query' => ['symbol' => $inst, 'count' => 1, 'reverse' => 'true'],
                ]);
                if ($resp->getStatusCode() !== 200) {
                    return null;
                }
                $data = json_decode((string) $resp->getBody(), true);
                $row = is_array($data) && isset($data[0]) && is_array($data[0]) ? $data[0] : null;
                if (!is_array($row)) {
                    return null;
                }
                $bid = $row['bidPrice'] ?? null;
                $ask = $row['askPrice'] ?? null;
                return $this->normalizeBidAsk($bid, $ask);
            }
        } catch (\Throwable $e) {
            Log::warning('exchange ticker failed', [
                'exchange' => $exchange,
                'symbol' => $symbol,
                'error' => $e->getMessage(),
            ]);
            return null;
        }

        return null;
    }

    private function splitSymbol(string $symbol): array
    {
        $s = trim($symbol);
        if ($s === '') {
            return ['', ''];
        }

        if (strpos($s, ':') !== false) {
            $parts = explode(':', $s);
            $s = (string) end($parts);
        }

        $s = strtoupper($s);
        $s = str_replace(' ', '', $s);

        if (strpos($s, '/') !== false) {
            [$base, $quote] = explode('/', $s, 2);
            return [trim($base), trim($quote)];
        }

        if (strpos($s, '-') !== false) {
            [$base, $quote] = explode('-', $s, 2);
            return [trim($base), trim($quote)];
        }

        $s = preg_replace('/[^A-Z0-9]/', '', $s) ?? '';
        if ($s === '') {
            return ['', ''];
        }

        $knownQuotes = [
            'USDT',
            'USDC',
            'USD',
            'EUR',
            'BTC',
            'ETH',
            'BNB',
            'TRY',
            'RUB',
            'GBP',
            'JPY',
            'UAH',
        ];

        foreach ($knownQuotes as $q) {
            if (strlen($s) > strlen($q) && str_ends_with($s, $q)) {
                $base = substr($s, 0, strlen($s) - strlen($q));
                $quote = $q;
                if ($base !== '') {
                    return [$base, $quote];
                }
            }
        }

        return ['', ''];
    }

    private function normalizeBidAsk($bid, $ask): ?array
    {
        if (!is_numeric($bid) || !is_numeric($ask)) {
            return null;
        }

        $bidF = (float) $bid;
        $askF = (float) $ask;

        if ($bidF <= 0 || $askF <= 0) {
            return null;
        }

        return [
            'bid' => $bidF,
            'ask' => $askF,
        ];
    }
}
