# Azure subscription & resource group

## Current documentation status

| Field | Value |
|-------|--------|
| Subscription ID | **Unknown** — not in repo; no active Azure portal access from engineering side documented here |
| Subscription name | **TBD** |
| Resource group(s) | **TBD** |
| Region(s) | **TBD** |
| VM resource name | **TBD** |

## What we infer

- There is at least one **Azure VM** used as the **Docker host** for FairDrive API (see GitHub Actions SSH deploy and `azureuser` home path in workflows).
- **Azure Blob Storage** and **Azure Cognitive Services** / **OpenAI** / **Communication** are used by the application (keys via env — not documented here).

## Action for org

A person with **Reader** or **Owner** on the subscription should export (internally):

1. Subscription ID + name  
2. Resource group containing the API VM  
3. VM name, size, disk, and networking (NSG rules if relevant)  
4. List of other Azure resources (storage accounts, etc.) used by FairDrive  

Paste a **sanitized** summary into this file or your internal wiki and link it here.
