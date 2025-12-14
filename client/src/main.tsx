import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Default admin user for development - initialize before any API calls
const DEV_USER_ID_KEY = "dev-user-id";
const DEV_USER_EMAIL_KEY = "dev-user-email";
const DEFAULT_DEV_USER_ID = "29c0ddeb-0039-4b87-9f68-d856600c0fd1";
const DEFAULT_DEV_USER_EMAIL = "redwan.mansour@outlook.com";

// Ensure dev user is set in localStorage immediately
if (!localStorage.getItem(DEV_USER_ID_KEY)) {
  localStorage.setItem(DEV_USER_ID_KEY, DEFAULT_DEV_USER_ID);
}
if (!localStorage.getItem(DEV_USER_EMAIL_KEY)) {
  localStorage.setItem(DEV_USER_EMAIL_KEY, DEFAULT_DEV_USER_EMAIL);
}

// Global fetch interceptor to add dev auth headers to all API requests
const originalFetch = window.fetch.bind(window);
window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Determine the URL
  let url: string;
  let existingHeaders: HeadersInit | undefined;
  
  if (typeof input === 'string') {
    url = input;
    existingHeaders = init?.headers;
  } else if (input instanceof URL) {
    url = input.href;
    existingHeaders = init?.headers;
  } else if (input instanceof Request) {
    url = input.url;
    // For Request objects, we need to merge headers from both the request and init
    existingHeaders = init?.headers ?? input.headers;
  } else {
    url = String(input);
    existingHeaders = init?.headers;
  }
  
  // Only add auth headers for API requests
  if (url.startsWith('/api')) {
    const headers = new Headers(existingHeaders);
    
    // Add dev auth headers from localStorage - always set them for API requests
    const devUserId = localStorage.getItem("dev-user-id");
    const devUserEmail = localStorage.getItem("dev-user-email");
    
    // Always set the headers (override any existing ones to ensure consistency)
    if (devUserId) {
      headers.set("x-dev-user-id", devUserId);
    }
    if (devUserEmail) {
      headers.set("x-dev-user-email", devUserEmail);
    }
    
    // Create new init object with merged headers
    const newInit: RequestInit = {
      ...init,
      headers,
      credentials: 'include',
    };
    
    // If input was a Request object, we need to handle it specially
    if (input instanceof Request) {
      // Clone the request with new init to preserve the body
      return originalFetch(new Request(input, newInit));
    }
    
    return originalFetch(input, newInit);
  }
  
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
