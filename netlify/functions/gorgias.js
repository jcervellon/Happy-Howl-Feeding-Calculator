exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Credentials live here on the server — agents never see these
  const SUBDOMAIN = process.env.GORGIAS_SUBDOMAIN;
  const EMAIL     = process.env.GORGIAS_EMAIL;
  const API_KEY   = process.env.GORGIAS_API_KEY;

  if (!SUBDOMAIN || !EMAIL || !API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gorgias credentials not configured. Check Netlify environment variables." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  const { ticketId, messageType, bodyText } = body;

  if (!ticketId || !messageType || !bodyText) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing ticketId, messageType, or bodyText." }),
    };
  }

  const gorgiasUrl = `https://${SUBDOMAIN}.gorgias.com/api/tickets/${ticketId}/messages`;
  const credentials = Buffer.from(`${EMAIL}:${API_KEY}`).toString("base64");

  try {
    const response = await fetch(gorgiasUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: messageType === "note" ? "internal-note" : "email",
        via: "helpdesk",
        body_text: bodyText,
        body_html: `<pre style="white-space:pre-wrap;font-family:monospace;font-size:13px">${bodyText}</pre>`,
      }),
    });

    const data = await response.text();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Gorgias error ${response.status}: ${data}` }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `Sent to ticket #${ticketId}` }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Request failed: ${err.message}` }),
    };
  }
};
