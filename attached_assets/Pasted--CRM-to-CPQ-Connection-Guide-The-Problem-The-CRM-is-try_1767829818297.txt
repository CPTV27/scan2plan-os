# CRM to CPQ Connection Guide

## The Problem

The CRM is trying to load the CPQ from a hardcoded URL (`https://cpq.scan2plan.dev`) which may be incorrect or inaccessible. The CPQ runs on Replit and has a different URL.

## Solution: Use the Correct Replit URL

### Step 1: Get the CPQ URL

The CPQ is hosted on Replit. The URL format is:
```
https://<repl-name>.<username>.repl.co
```

Or if published:
```
https://<custom-subdomain>.replit.app
```

**Current development URL**: Check the Replit workspace - it shows the URL in the webview panel.

### Step 2: Update CRM Configuration

In the CRM app, update the CPQ URL to use an environment variable:

```javascript
// Instead of hardcoded URL:
const CPQ_URL = "https://cpq.scan2plan.dev";  // ❌ Wrong

// Use environment variable:
const CPQ_URL = process.env.CPQ_URL || import.meta.env.VITE_CPQ_URL;  // ✅ Correct
```

### Step 3: Set Environment Variable in CRM

Add to the CRM's Replit Secrets:
```
VITE_CPQ_URL=https://your-cpq-repl-url.replit.app
```

## Iframe Embedding

The CRM embeds the CPQ in an iframe. Here's the correct pattern:

```tsx
// In CRM's CPQ Drawer component:
const CPQ_URL = import.meta.env.VITE_CPQ_URL || "https://your-cpq-url.replit.app";

function CPQDrawer({ isOpen, projectData }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Listen for CPQ_READY message
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "CPQ_READY") {
        setIsLoading(false);
        // Send project data to CPQ
        if (projectData && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: "CPQ_SCOPING_PAYLOAD",
            payload: projectData
          }, "*");
        }
      }
      
      if (event.data?.type === "CPQ_QUOTE_SAVED") {
        // Handle quote saved - refresh CRM data
        console.log("Quote saved:", event.data.quote);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [projectData]);

  return (
    <div className="cpq-drawer">
      {isLoading && <div className="loading-spinner">Loading CPQ...</div>}
      {hasError && (
        <div className="error-message">
          Failed to load CPQ. Please check the connection.
          <button onClick={() => setHasError(false)}>Retry</button>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={CPQ_URL}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="clipboard-write"
      />
    </div>
  );
}
```

## Message Protocol

### Messages FROM CPQ (listen in CRM):

| Message Type | When Sent | Payload |
|--------------|-----------|---------|
| `CPQ_READY` | When CPQ iframe loads | `{ type: "CPQ_READY" }` |
| `CPQ_QUOTE_SAVED` | After quote is saved | `{ type: "CPQ_QUOTE_SAVED", quote: {...} }` |

### Messages TO CPQ (send from CRM):

| Message Type | When to Send | Payload |
|--------------|--------------|---------|
| `CPQ_SCOPING_PAYLOAD` | After receiving CPQ_READY | `{ type: "CPQ_SCOPING_PAYLOAD", payload: {...} }` |

## Payload Structure

The `CPQ_SCOPING_PAYLOAD` should include:

```javascript
{
  type: "CPQ_SCOPING_PAYLOAD",
  payload: {
    // Project Info
    projectName: "Office Building Scan",
    projectAddress: "123 Main St, City, ST 12345",
    
    // Client Info
    clientName: "ACME Corporation",
    clientEmail: "contact@acme.com",
    
    // Areas (optional - can be added in CPQ)
    areas: [
      {
        name: "Floor 1",
        buildingType: "1", // Building type ID
        squareFeet: "25000",
        disciplines: ["arch", "struct"],
        disciplineLods: { arch: "200", struct: "200" }
      }
    ],
    
    // Project settings
    travelType: "local", // or "fly-out"
    riskLevel: "low",
    
    // Contacts
    accountContact: "John Smith",
    accountContactEmail: "john@acme.com"
  }
}
```

## CORS Configuration

The CPQ on Replit automatically handles CORS for iframe embedding. No additional configuration needed.

If you see CORS errors:
1. Make sure you're using the correct Replit URL (not a custom domain that might have different CORS settings)
2. Ensure the iframe `src` uses HTTPS
3. Check that the CPQ Replit is running (not stopped)

## Troubleshooting

### "Connection Error" or Blank Iframe

1. **Check URL**: Verify the CPQ URL is correct and accessible
   - Open the CPQ URL directly in a browser tab
   - If it loads, the URL is correct

2. **Check if CPQ is running**: The Replit might be stopped
   - Go to the CPQ Replit workspace
   - Click "Run" if it's not running

3. **Check Console**: Look for specific error messages
   ```javascript
   // Add error logging
   iframe.addEventListener("error", (e) => console.error("Iframe error:", e));
   ```

### CPQ Loads but No Data Appears

1. **Check message timing**: Send data only AFTER receiving `CPQ_READY`
2. **Verify payload structure**: Console.log the payload before sending
3. **Check CPQ console**: Look for "CPQ received prefill data" log message

### Quote Doesn't Save Back to CRM

1. **Listen for CPQ_QUOTE_SAVED**: Make sure the event listener is set up
2. **Check origin**: The CPQ posts to `"*"` so origin filtering shouldn't be an issue
3. **Verify quote sync endpoint**: The CPQ calls `/api/external/quote-sync` on the CRM

## Quick Checklist

- [ ] CPQ Replit is running
- [ ] `VITE_CPQ_URL` environment variable is set in CRM
- [ ] Iframe uses the correct URL from env var
- [ ] CRM listens for `CPQ_READY` before sending data
- [ ] CRM sends `CPQ_SCOPING_PAYLOAD` with project data
- [ ] CRM listens for `CPQ_QUOTE_SAVED` for updates
