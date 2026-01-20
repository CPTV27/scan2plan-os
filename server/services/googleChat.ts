/**
 * Google Chat Notification Service
 * Sends formatted Cards to Google Chat Spaces via Webhooks
 */

import { log } from "../lib/logger";

interface ChatCardProps {
  title: string;
  subtitle?: string;
  text: string;
  imageUrl?: string;
  buttonUrl?: string;
  buttonText?: string;
  type: 'success' | 'alert' | 'info';
}

const ICONS = {
  success: 'https://fonts.gstatic.com/s/e/notoemoji/15.0/2705/72.png', // Check mark
  alert: 'https://fonts.gstatic.com/s/e/notoemoji/15.0/26a0/72.png', // Warning
  info: 'https://fonts.gstatic.com/s/e/notoemoji/15.0/2139/72.png' // Info
};

export async function sendToGoogleChat(space: 'sales' | 'ops', data: ChatCardProps): Promise<boolean> {
  const webhookUrl = space === 'sales' 
    ? process.env.GOOGLE_CHAT_WEBHOOK_SALES 
    : process.env.GOOGLE_CHAT_WEBHOOK_OPS;

  if (!webhookUrl) {
    log(`WARN: [GoogleChat] No webhook configured for ${space} space`);
    return false;
  }

  const icon = ICONS[data.type] || ICONS.info;

  const cardPayload = {
    cards: [{
      header: {
        title: data.title,
        subtitle: data.subtitle,
        imageUrl: icon,
        imageStyle: "IMAGE"
      },
      sections: [
        {
          widgets: [
            { textParagraph: { text: data.text } }
          ]
        },
        ...(data.buttonUrl ? [{
          widgets: [
            {
              buttons: [
                {
                  textButton: {
                    text: data.buttonText || "View in S2P OS",
                    onClick: { openLink: { url: data.buttonUrl } }
                  }
                }
              ]
            }
          ]
        }] : [])
      ]
    }]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`ERROR: [GoogleChat] Failed to send to ${space}: ${response.status} - ${errorText}`);
      return false;
    }

    log(`[GoogleChat] Notification sent to ${space} space`);
    return true;
  } catch (error) {
    log(`ERROR: [GoogleChat] Error sending to ${space} - ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Send notification when a deal is Closed Won
 */
export async function notifyClosedWon(deal: {
  id: number;
  name: string;
  value: string | number;
  ownerName?: string;
}, baseUrl: string): Promise<void> {
  const value = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number(deal.value) || 0);

  await sendToGoogleChat('sales', {
    type: 'success',
    title: "New Deal Closed!",
    subtitle: deal.name,
    text: `<b>Value:</b> ${value}<br><b>Owner:</b> ${deal.ownerName || 'Sales Team'}<br>Time to onboard!`,
    buttonText: "Open Deal",
    buttonUrl: `${baseUrl}/deals/${deal.id}`
  });
}

/**
 * Send notification when Truth Loop detects high variance
 */
export async function notifyTruthLoopVariance(project: {
  id: number;
  name: string;
}, variance: number, savingsAmount: number, baseUrl: string): Promise<void> {
  const variancePct = (variance * 100).toFixed(1);
  const savings = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(savingsAmount);

  await sendToGoogleChat('ops', {
    type: 'alert',
    title: "Truth Loop Triggered",
    subtitle: `Variance: ${variancePct}% Detected`,
    text: `<b>Project:</b> ${project.name}<br><b>Risk Avoided:</b> ${savings}<br>Delivery has been locked. Marketing loop activated.`,
    buttonText: "Review Audit",
    buttonUrl: `${baseUrl}/production/${project.id}`
  });
}
