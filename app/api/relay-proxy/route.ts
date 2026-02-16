import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_API_PORT = 5052;
const TIMEOUT_MS = 10000;

/**
 * Proxy API for relay node requests.
 * Avoids CORS issues by making requests from the server side.
 *
 * Query params:
 * - endpoint: The relay node IP address (required)
 * - path: The API path to call (required, e.g., /peers/rtt)
 * - port: The API port (optional, defaults to 5052)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint');
  const path = searchParams.get('path');
  const portParam = searchParams.get('port');
  const port = portParam ? parseInt(portParam, 10) : DEFAULT_API_PORT;

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Missing endpoint parameter' },
      { status: 400 }
    );
  }

  if (!path) {
    return NextResponse.json(
      { error: 'Missing path parameter' },
      { status: 400 }
    );
  }

  // Validate endpoint format (basic IP validation)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  if (!ipRegex.test(endpoint) && !hostnameRegex.test(endpoint)) {
    return NextResponse.json(
      { error: 'Invalid endpoint format' },
      { status: 400 }
    );
  }

  // Block private IP ranges to prevent SSRF
  if (ipRegex.test(endpoint)) {
    const parts = endpoint.split('.').map(Number);
    // Block 127.0.0.0/8 (localhost), 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    if (
      parts[0] === 127 ||
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 0 ||
      parts[0] === 169 && parts[1] === 254
    ) {
      return NextResponse.json(
        { error: 'Access to private IP ranges is not allowed' },
        { status: 403 }
      );
    }
  }

  // Ensure path starts with /
  const apiPath = path.startsWith('/') ? path : `/${path}`;
  const url = `http://${endpoint}:${port}${apiPath}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Relay API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout', details: `Failed to reach ${endpoint}` },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to connect to relay node', details: error.message },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Proxy POST requests to relay node.
 *
 * Query params:
 * - endpoint: The relay node IP address (required)
 * - path: The API path to call (required)
 *
 * Body: JSON body to forward to the relay node (optional)
 */
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint');
  const path = searchParams.get('path');
  const portParam = searchParams.get('port');
  const port = portParam ? parseInt(portParam, 10) : DEFAULT_API_PORT;

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Missing endpoint parameter' },
      { status: 400 }
    );
  }

  if (!path) {
    return NextResponse.json(
      { error: 'Missing path parameter' },
      { status: 400 }
    );
  }

  // Validate endpoint format
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  if (!ipRegex.test(endpoint) && !hostnameRegex.test(endpoint)) {
    return NextResponse.json(
      { error: 'Invalid endpoint format' },
      { status: 400 }
    );
  }

  const apiPath = path.startsWith('/') ? path : `/${path}`;
  const url = `http://${endpoint}:${port}${apiPath}`;

  try {
    // Get request body if present
    let body: string | undefined;
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const jsonBody = await request.json();
      body = JSON.stringify(jsonBody);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Relay API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout', details: `Failed to reach ${endpoint}` },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to connect to relay node', details: error.message },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Proxy DELETE requests to relay node.
 */
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint');
  const path = searchParams.get('path');
  const portParam = searchParams.get('port');
  const port = portParam ? parseInt(portParam, 10) : DEFAULT_API_PORT;

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Missing endpoint parameter' },
      { status: 400 }
    );
  }

  if (!path) {
    return NextResponse.json(
      { error: 'Missing path parameter' },
      { status: 400 }
    );
  }

  // Validate endpoint format
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  if (!ipRegex.test(endpoint) && !hostnameRegex.test(endpoint)) {
    return NextResponse.json(
      { error: 'Invalid endpoint format' },
      { status: 400 }
    );
  }

  const apiPath = path.startsWith('/') ? path : `/${path}`;
  const url = `http://${endpoint}:${port}${apiPath}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Relay API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout', details: `Failed to reach ${endpoint}` },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to connect to relay node', details: error.message },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Proxy PATCH requests to relay node.
 */
export async function PATCH(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint');
  const path = searchParams.get('path');
  const portParam = searchParams.get('port');
  const port = portParam ? parseInt(portParam, 10) : DEFAULT_API_PORT;

  console.log('[relay-proxy PATCH] endpoint:', endpoint, 'path:', path, 'port:', port);

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Missing endpoint parameter' },
      { status: 400 }
    );
  }

  if (!path) {
    return NextResponse.json(
      { error: 'Missing path parameter' },
      { status: 400 }
    );
  }

  // Validate endpoint format
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  if (!ipRegex.test(endpoint) && !hostnameRegex.test(endpoint)) {
    return NextResponse.json(
      { error: 'Invalid endpoint format' },
      { status: 400 }
    );
  }

  const apiPath = path.startsWith('/') ? path : `/${path}`;
  const url = `http://${endpoint}:${port}${apiPath}`;

  try {
    let body: string | undefined;
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const jsonBody = await request.json();
      body = JSON.stringify(jsonBody);
      console.log('[relay-proxy PATCH] body:', body);
    }

    console.log('[relay-proxy PATCH] Forwarding to:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('[relay-proxy PATCH] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[relay-proxy PATCH] Error:', errorText);
      return NextResponse.json(
        { error: `Relay API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[relay-proxy PATCH] Success response:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[relay-proxy PATCH] Exception:', error);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout', details: `Failed to reach ${endpoint}` },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to connect to relay node', details: error.message },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: 'Unknown error' },
      { status: 500 }
    );
  }
}
