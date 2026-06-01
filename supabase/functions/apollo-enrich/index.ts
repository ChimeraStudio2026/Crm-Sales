import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnrichRequest {
    companyName?: string;
    email?: string;
    domain?: string;
    healthCheck?: boolean;
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

async function apolloFetch(path: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
    const apiKey = Deno.env.get("APOLLO_API_KEY");
    if (!apiKey) {
        throw new Error("APOLLO_API_KEY non configurata. Aggiungila in Supabase → Edge Functions → Secrets.");
    }
    const url = path.startsWith("http") ? path : `${APOLLO_BASE}${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": apiKey,
            ...(options.headers || {}),
        },
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
        const rawMessage = String(data.error || data.message || `Apollo HTTP ${response.status}`);
        if (rawMessage.includes("not accessible with this api_key")) {
            throw new Error(
                "La API key Apollo non ha permessi per l'arricchimento. Su Apollo.io serve un piano con API Organization Enrich attiva.",
            );
        }
        throw new Error(rawMessage);
    }
    return data;
}

function extractDomainFromEmail(email: string): string | null {
    const parts = email.split("@");
    if (parts.length !== 2) return null;
    const domain = parts[1].trim().toLowerCase();
    if (!domain || domain.includes("gmail.") || domain.includes("yahoo.") || domain.includes("hotmail.")) {
        return null;
    }
    return domain;
}

function buildDescription(org: Record<string, unknown>): string {
    const chunks: string[] = [];
    const industry = org.industry ? String(org.industry) : "";
    const city = org.city ? String(org.city) : "";
    const country = org.country ? String(org.country) : "";
    const employees = org.estimated_num_employees ? Number(org.estimated_num_employees) : 0;
    const revenue = org.annual_revenue_printed ? String(org.annual_revenue_printed) : "";
    const shortDescription = org.short_description ? String(org.short_description) : "";
    const linkedinUrl = org.linkedin_url ? String(org.linkedin_url) : "";
    const primaryDomain = org.primary_domain ? String(org.primary_domain) : "";
    if (industry) chunks.push(`Settore: ${industry}`);
    if (city || country) chunks.push(`Sede: ${[city, country].filter(Boolean).join(", ")}`);
    if (employees > 0) chunks.push(`Dipendenti: ~${employees}`);
    if (revenue) chunks.push(`Fatturato stimato: ${revenue}`);
    if (primaryDomain) chunks.push(`Dominio: ${primaryDomain}`);
    if (linkedinUrl) chunks.push(`LinkedIn: ${linkedinUrl}`);
    if (shortDescription) chunks.push(shortDescription);
    return chunks.join("\n").slice(0, 1200);
}

async function searchOrganizationByName(companyName: string): Promise<Record<string, unknown> | null> {
    const searchUrl = new URL(`${APOLLO_BASE}/mixed_companies/search`);
    searchUrl.searchParams.set("q_organization_name", companyName);
    searchUrl.searchParams.set("page", "1");
    searchUrl.searchParams.set("per_page", "5");
    const searchResult = await apolloFetch(searchUrl.toString(), { method: "POST" });
    const accounts = Array.isArray(searchResult.accounts) ? searchResult.accounts as Record<string, unknown>[] : [];
    const organizations = Array.isArray(searchResult.organizations)
        ? searchResult.organizations as Record<string, unknown>[]
        : [];
    const candidates = [...accounts, ...organizations];
    if (candidates.length === 0) return null;
    const normalizedName = companyName.toLowerCase();
    const match = candidates.find((item) => {
        const name = String(item.name || "").toLowerCase();
        return name.includes(normalizedName) || normalizedName.includes(name);
    });
    return match || candidates[0];
}

async function enrichOrganizationByDomain(domain: string): Promise<Record<string, unknown> | null> {
    const enriched = await apolloFetch(`/organizations/enrich?domain=${encodeURIComponent(domain)}`);
    const organization = enriched.organization;
    if (organization && typeof organization === "object") {
        return organization as Record<string, unknown>;
    }
    return null;
}

async function findContactEmail(companyName: string, domain: string | null): Promise<string> {
    const peopleUrl = new URL(`${APOLLO_BASE}/people/match`);
    peopleUrl.searchParams.set("organization_name", companyName);
    if (domain) peopleUrl.searchParams.set("domain", domain);
    const peopleResult = await apolloFetch(peopleUrl.toString(), { method: "POST" });
    const person = peopleResult.person;
    if (person && typeof person === "object") {
        const email = (person as Record<string, unknown>).email;
        if (typeof email === "string" && email.trim()) return email.trim();
    }
    return "";
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (req.method === "GET") {
        const hasKey = !!Deno.env.get("APOLLO_API_KEY");
        return jsonResponse({ ok: hasKey, configured: hasKey });
    }
    if (req.method !== "POST") {
        return jsonResponse({ ok: false, error: "Metodo non consentito" }, 405);
    }
    try {
        const body = await req.json() as EnrichRequest;
        if (body.healthCheck) {
            const hasKey = !!Deno.env.get("APOLLO_API_KEY");
            return jsonResponse({ ok: hasKey, configured: hasKey });
        }
        const companyName = body.companyName?.trim() || "";
        const inputEmail = body.email?.trim() || "";
        let domain = body.domain?.trim().toLowerCase() || null;
        if (!domain && inputEmail) domain = extractDomainFromEmail(inputEmail);
        if (!companyName && !inputEmail && !domain) {
            return jsonResponse({ ok: false, error: "companyName, email o domain richiesti" });
        }
        let organization: Record<string, unknown> | null = null;
        if (domain) {
            organization = await enrichOrganizationByDomain(domain);
        }
        if (!organization && companyName) {
            const searchMatch = await searchOrganizationByName(companyName);
            if (searchMatch) {
                const matchDomain = String(searchMatch.primary_domain || searchMatch.domain || "");
                if (matchDomain) {
                    domain = matchDomain.toLowerCase();
                    organization = await enrichOrganizationByDomain(matchDomain) || searchMatch;
                } else {
                    organization = searchMatch;
                }
            }
        }
        let contactEmail = inputEmail;
        if (!contactEmail && companyName) {
            contactEmail = await findContactEmail(companyName, domain);
        }
        if (!organization && !contactEmail) {
            return jsonResponse({ ok: false, error: "Nessun dato trovato su Apollo per questo cliente" });
        }
        const org = organization || {};
        const websiteDomain = String(org.primary_domain || domain || "");
        const websiteUrl = org.website_url
            ? String(org.website_url)
            : (websiteDomain ? `https://${websiteDomain}` : "");
        return jsonResponse({
            ok: true,
            email: contactEmail,
            phone: org.phone ? String(org.phone) : "",
            website: websiteUrl,
            domain: websiteDomain,
            industry: org.industry ? String(org.industry) : "",
            linkedinUrl: org.linkedin_url ? String(org.linkedin_url) : "",
            employeeCount: org.estimated_num_employees ? Number(org.estimated_num_employees) : null,
            description: buildDescription(org),
            organizationName: org.name ? String(org.name) : companyName,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Errore Apollo";
        return jsonResponse({ ok: false, error: message });
    }
});
