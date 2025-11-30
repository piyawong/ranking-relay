import { NextRequest, NextResponse } from 'next/server';

const API_PORT = 5052;
const TIMEOUT_MS = 10000;

/**
 * Proxy API for relay node requests.
 * Avoids CORS issues by making requests from the server side.
 *
 * Query params:
 * - endpoint: The relay node IP address (required)
 * - path: The API path to call (required, e.g., /peers/rtt)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint');
  const path = searchParams.get('path');

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

  // Ensure path starts with /
  const apiPath = path.startsWith('/') ? path : `/${path}`;
  const url = `http://${endpoint}:${API_PORT}${apiPath}`;

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
  const url = `http://${endpoint}:${API_PORT}${apiPath}`;

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
  const url = `http://${endpoint}:${API_PORT}${apiPath}`;

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
  const url = `http://${endpoint}:${API_PORT}${apiPath}`;

  try {
    let body: string | undefined;
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const jsonBody = await request.json();
      body = JSON.stringify(jsonBody);
    }

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
