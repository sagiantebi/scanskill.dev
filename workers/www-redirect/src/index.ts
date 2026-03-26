/// <reference types="@cloudflare/workers-types" />

const CANONICAL_HOST = 'scanskill.dev'

const handler: ExportedHandler = {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url)
    url.hostname = CANONICAL_HOST
    url.protocol = 'https:'

    return Response.redirect(url.toString(), 308)
  },
}

export default handler
