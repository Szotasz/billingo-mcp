# Billingo MCP Server

An MCP (Model Context Protocol) server for the [Billingo](https://www.billingo.hu/) invoicing API (v3). This server enables AI assistants like Claude to manage invoices, partners, products, expenses, and more through natural language.

[Magyar nyelvű dokumentáció lentebb / Hungarian docs below](#magyar)

---

## Features

- **Documents/Invoices** — Create, list, cancel, copy, download PDF, send via email, manage payments, check NAV Online Szamla status
- **Partners** — Create, update, delete and search customers/suppliers
- **Products** — Manage your product/service catalog
- **Bank Accounts** — CRUD operations for company bank accounts
- **Spending/Expenses** — Track and manage business expenses
- **Document Export** — Export invoices to Excel/CSV
- **Organization** — Retrieve your company data
- **Utilities** — Verify tax numbers via NAV, get MNB currency exchange rates, list document blocks

## Available Tools (35)

| Category | Tools |
|---|---|
| Documents | `list_documents`, `get_document`, `create_document`, `cancel_document`, `delete_draft`, `create_from_proforma`, `create_from_draft`, `create_modification_document`, `copy_document`, `download_document`, `get_document_public_url`, `send_document` |
| Payments | `get_payment`, `update_payment`, `delete_payment`, `get_online_szamla_status` |
| Partners | `list_partners`, `get_partner`, `create_partner`, `update_partner`, `delete_partner` |
| Products | `list_products`, `get_product`, `create_product`, `update_product`, `delete_product` |
| Bank Accounts | `list_bank_accounts`, `get_bank_account`, `create_bank_account`, `update_bank_account`, `delete_bank_account` |
| Spending | `list_spending`, `get_spending`, `create_spending`, `update_spending`, `delete_spending` |
| Export | `create_document_export`, `download_document_export` |
| Organization | `get_organization` |
| Utilities | `check_tax_number`, `get_currency_rates`, `list_document_blocks` |

## Prerequisites

- Node.js 18+
- A [Billingo](https://www.billingo.hu/) account with an API v3 key ([generate one here](https://app.billingo.hu/api-key))

## Installation

```bash
git clone https://github.com/Szotasz/billingo-mcp.git
cd billingo-mcp
npm install
npm run build
```

## Configuration

### Claude Code

Add to your `~/.claude.json` (or project-level `.claude.json`):

```json
{
  "mcpServers": {
    "billingo": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/billingo-mcp/dist/index.js"],
      "env": {
        "BILLINGO_API_KEY": "your-billingo-api-key"
      }
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "billingo": {
      "command": "node",
      "args": ["/path/to/billingo-mcp/dist/index.js"],
      "env": {
        "BILLINGO_API_KEY": "your-billingo-api-key"
      }
    }
  }
}
```

### Cursor

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "billingo": {
      "command": "node",
      "args": ["/path/to/billingo-mcp/dist/index.js"],
      "env": {
        "BILLINGO_API_KEY": "your-billingo-api-key"
      }
    }
  }
}
```

## Usage Examples

Once configured, you can ask your AI assistant:

- "List my invoices from last month"
- "Create an invoice for partner X with 2 items"
- "Download invoice #123 as PDF"
- "Check the tax number 12345678"
- "What is today's EUR/HUF exchange rate?"
- "Show me unpaid invoices"
- "Send invoice #456 to client@example.com"

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Test locally
BILLINGO_API_KEY=your-key node dist/index.js
```

## License

MIT

---

<a name="magyar"></a>

# Billingo MCP Szerver (Magyar)

MCP (Model Context Protocol) szerver a [Billingo](https://www.billingo.hu/) számlázó API-hoz (v3). Ezzel a szerverrel AI asszisztensek (pl. Claude) természetes nyelven kezelhetik a számlákat, partnereket, termékeket, költségeket és egyéb számlázási feladatokat.

## Funkciók

- **Számlák/Bizonylatok** — Létrehozás, listázás, sztornózás, másolás, PDF letöltés, e-mail küldés, fizetéskezelés, NAV Online Számla státusz
- **Partnerek** — Ügyfelek/szállítók kezelése (CRUD + keresés)
- **Termékek** — Termék/szolgáltatás katalógus kezelése
- **Bankszámlák** — Céges bankszámlák kezelése
- **Költségek** — Üzleti költségek rögzítése és kezelése
- **Dokumentum export** — Számlák exportálása Excel/CSV formátumban
- **Szervezet** — Cégadatok lekérése
- **Segédeszközök** — NAV adószám-ellenőrzés, MNB árfolyamok, számlatömbök listázása

## Előfeltételek

- Node.js 18+
- [Billingo](https://www.billingo.hu/) fiók API v3 kulccsal ([generálás itt](https://app.billingo.hu/api-key))

## Telepítés

```bash
git clone https://github.com/Szotasz/billingo-mcp.git
cd billingo-mcp
npm install
npm run build
```

## Beállítás

### Claude Code

Add hozzá a `~/.claude.json` fájlhoz (vagy projekt szintű `.claude.json`-hoz):

```json
{
  "mcpServers": {
    "billingo": {
      "type": "stdio",
      "command": "node",
      "args": ["/útvonal/billingo-mcp/dist/index.js"],
      "env": {
        "BILLINGO_API_KEY": "a-te-billingo-api-kulcsod"
      }
    }
  }
}
```

### Claude Desktop

Add hozzá a Claude Desktop konfighoz (`~/Library/Application Support/Claude/claude_desktop_config.json` macOS-en):

```json
{
  "mcpServers": {
    "billingo": {
      "command": "node",
      "args": ["/útvonal/billingo-mcp/dist/index.js"],
      "env": {
        "BILLINGO_API_KEY": "a-te-billingo-api-kulcsod"
      }
    }
  }
}
```

### Cursor

Add hozzá a `.cursor/mcp.json` fájlhoz:

```json
{
  "mcpServers": {
    "billingo": {
      "command": "node",
      "args": ["/útvonal/billingo-mcp/dist/index.js"],
      "env": {
        "BILLINGO_API_KEY": "a-te-billingo-api-kulcsod"
      }
    }
  }
}
```

## Használati példák

A beállítás után az AI asszisztensnek mondhatod:

- "Listázd az elmúlt havi számláimat"
- "Készíts egy számlát X partnernek 2 tétellel"
- "Töltsd le a 123-as számlát PDF-ben"
- "Ellenőrizd a 12345678 adószámot"
- "Mi a mai EUR/HUF árfolyam?"
- "Mutasd a kifizetetlen számlákat"
- "Küldd el a 456-os számlát a ugyfel@pelda.hu címre"

## Fejlesztés

```bash
# Függőségek telepítése
npm install

# TypeScript fordítás
npm run build

# Helyi teszt
BILLINGO_API_KEY=a-te-kulcsod node dist/index.js
```

## Licensz

MIT
